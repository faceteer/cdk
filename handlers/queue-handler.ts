import {
	SendMessageBatchCommand,
	SendMessageBatchRequestEntry,
	SQSClient,
} from '@aws-sdk/client-sqs';
import type {
	SQSBatchItemFailure,
	SQSHandler,
	SQSMessageAttribute,
	SQSRecord,
} from 'aws-lambda';
import { constantCase } from 'constant-case';
import * as crypto from 'crypto';
import pLimit from 'p-limit';
import { AsyncHandler, HandlerDefinition, HandlerTypes } from './handler';
import type { InvalidMessage, Message, ValidatedMessage } from './message';

export interface QueueHandlerDefinition extends HandlerDefinition {
	/**
	 * A name for the queue.
	 */
	queueName: string;

	/**
	 * The largest number of records that AWS Lambda will retrieve from your event source at the time of invoking your function.
	 *
	 * Valid Range: Minimum value of 1. Maximum value of 10.
	 * If `maxBatchingWindow` is configured, this value can go up to 10,000.
	 *
	 * @default 10
	 */
	batchSize?: number;

	/**
	 * The maximum amount of time to gather records before invoking the function.
	 *
	 * Valid Range: Minimum value of 0 minutes. Maximum value of 5 minutes.
	 *
	 * @default - no batching window. The lambda function will be invoked immediately with the records that are available.
	 */
	maxBatchingWindow?: number;

	/**
	 * How many times to attempt processing a message
	 *
	 * @default 10
	 */
	maximumAttempts?: number;
}

export type QueueHandlerEvent<T> = {
	/**
	 * The raw SQS records
	 */
	Records: SQSRecord[];
	/**
	 * Messages that have been validated
	 */
	ValidMessages: ValidatedMessage<T>[];
	/**
	 * Messages that failed to validate
	 */
	InvalidMessages: InvalidMessage[];
};

export type DlqHandlerEvent = {
	/**
	 * The raw SQS records
	 */
	Records: SQSRecord[];
};

export type QueueHandlerResponse<T> = {
	retry: ValidatedMessage<T>[];
} | void;

export interface QueueHandlerOptions<T> extends QueueHandlerDefinition {
	validator?: (messageBody: any) => T;

	sqs: SQSClient;
}

export interface QueueResults<T> {
	Failed: { message: Message<T>; error: unknown }[];
	Sent: Message<T>[];
}

export type QueueHandlerWithDefinition<T> = SQSHandler & {
	type: HandlerTypes.Queue;
	definition: QueueHandlerDefinition;
	sendMessages: (messages: Message<T>[]) => Promise<QueueResults<T>>;
};

export interface SendMessagesOptions<T> {
	/**
	 * How many parallel requests to
	 * make to SQS at a time
	 */
	concurrentRequestLimit?: number;
	/**
	 * A unique key used to deduplicate events before
	 * sending them in a batch. Otherwise a hash of the
	 * event is used
	 */
	uniqueKey?: keyof T;
	/**
	 * Randomly delay the message by up to N seconds.
	 *
	 * Max 900
	 */
	randomDelay?: number;
}

/**
 * A function that sends messages to a queue
 */
export type QueueSender<T> = (
	messages: Message<T>[],
	options?: SendMessagesOptions<T>,
) => Promise<QueueResults<T>>;

/**
 * Class to help connecting to and interfacing with
 * sqs driven lambda functions
 */
export class QueueManager {
	/**
	 * The maximum size for an SQS message
	 */
	static readonly MAX_MESSAGE_SIZE_IN_BYTES = 262144;

	/**
	 * You can only delay a message in SQS for up
	 * to 900 seconds (15 minutes)
	 */
	static readonly MAX_DELAY_IN_SECONDS = 900;

	/**
	 * ## Get the URI for a Queue and DLQ
	 *
	 * This is assuming that environment variables are set for the
	 * queue names. The environment variables should be the queue name
	 * converted to constant case
	 * @param queueName
	 */
	static getUris(queueName: string) {
		const queueEnvironmentVariable = `QUEUE_${constantCase(queueName)}`;
		const dlqEnvironmentVariable = `DLQ_${constantCase(queueName)}`;

		const name = process.env[queueEnvironmentVariable];
		const dlqName = process.env[dlqEnvironmentVariable];

		if (!name || !dlqName) {
			throw new Error(`Environment variables not set for queue ${queueName}`);
		}

		return {
			uri: `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.ACCOUNT_ID}/${name}`,
			dlq: `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.ACCOUNT_ID}/${dlqName}`,
		};
	}

	/**
	 * ## Get the delay in seconds for an SQS message
	 *
	 * This function will return a exponential back off delay with a maximum
	 * of 900 seconds based on how many times the message
	 * has been attempted to be processed.
	 *
	 * If the `randomDelay` option is set it will also generate
	 * a random delay between 0 and the value of `randomDelay`
	 *
	 * The higher value of the random delay or the exponential
	 * back off will be chosen
	 * @param attempts How many times the message has tried to be processed
	 * @param randomDelay How long to randomly delay the message for in seconds
	 */
	static getDelay(attempts: number, randomDelay?: number) {
		const delayInSeconds = Math.min(
			2 ** attempts - 1,
			this.MAX_DELAY_IN_SECONDS,
		);
		if (!randomDelay) {
			return delayInSeconds;
		}

		const maxDelay = Math.min(this.MAX_DELAY_IN_SECONDS, randomDelay);
		const randomDelayInSeconds = Math.floor(Math.random() * maxDelay);

		return Math.max(delayInSeconds, randomDelayInSeconds);
	}

	/**
	 * Generate a bound function that can send events to an SQS queue
	 * @param sqs
	 * @param queueName
	 * @returns
	 */
	static generateQueueSender<T>(
		sqs: SQSClient,
		queueName: string,
	): QueueSender<T> {
		return (messages, options) => {
			return this.send<T>(sqs, queueName, messages, options);
		};
	}

	/**
	 * ## Send messages to an SQS queue
	 *
	 * This function handles things like properly batching messages
	 * into groups of 10, and making sure that the overall size
	 * of the batch isn't greater than the maximum allowed size
	 * @param sqs A configured instance of an Amazon SQS client
	 * @param queueName The name of the queue that the events should be sent to
	 * @param messages An array of messages that should be sent
	 * @param options Options for configuring sending batches to SQS
	 */
	static async send<T>(
		sqs: SQSClient,
		queueName: string,
		messages: Message<T>[],
		{
			concurrentRequestLimit = 2,
			uniqueKey,
			randomDelay,
		}: SendMessagesOptions<T> = {},
	): Promise<QueueResults<T>> {
		const uris = this.getUris(queueName);
		const queueResults: QueueResults<T> = {
			Failed: [],
			Sent: [],
		};

		/**
		 * if we don't have any events to queue we'll just
		 * return an empty result set. This prevents us from
		 * making unneeded calls to SQS
		 */
		if (messages.length === 0) {
			return queueResults;
		}

		const limit = pLimit(concurrentRequestLimit);

		/**
		 * This map is used to deduplicate any messages
		 * when queuing up batches
		 */
		const messagesById: Map<string, Message<T>> = new Map();

		/**
		 * All of the batches that we'll be sending to SQS
		 */
		const messageBatches: Map<string, SendMessageBatchRequestEntry>[] = [];

		/** The index of the current batch that's being created */
		let currentBatchIndex = 0;
		/** The byte length of the batch being created */
		let currentBatchByteLength = 0;
		/**
		 * The current working batch
		 */
		let currentBatch: Map<string, SendMessageBatchRequestEntry> = new Map();
		messageBatches[currentBatchIndex] = currentBatch;
		for (const message of messages) {
			const delay = this.getDelay(message.attempts, randomDelay);
			message.attempts++;
			const body = JSON.stringify(message.body);
			const byteLength = Buffer.byteLength(body);

			// If a message is over the SQS limit we can't batch it
			if (byteLength > this.MAX_MESSAGE_SIZE_IN_BYTES) {
				queueResults.Failed.push({
					message,
					error: new Error('Message is too large for SQS'),
				});
				continue;
			}

			// Every message in a batch needs to have a unique id.
			// We can use a specified key as the unique ID, or we can
			// just hash the body of the message
			let id: string;
			if (uniqueKey) {
				id = String(message.body[uniqueKey]).substring(0, 80); // 80 is the maximum length for a batched message id
			} else {
				id = crypto
					.createHash('sha256')
					.update(body)
					.digest('hex')
					.substring(0, 80); // 80 is the maximum length for a batched message id
			}

			// Add the byte length to the current batch and
			// check to see if it's too large
			currentBatchByteLength += byteLength;

			// If the batch size is too large, or we already have 10 events
			// in a batch we'll create a new batch
			if (
				currentBatchByteLength > this.MAX_MESSAGE_SIZE_IN_BYTES ||
				currentBatch.size >= 10
			) {
				// If this message doesn't fit in the current batch
				// We'll start a new batch.
				currentBatchIndex++;
				currentBatchByteLength = byteLength;
				messageBatches[currentBatchIndex] = new Map();
				currentBatch = messageBatches[currentBatchIndex];
			}

			// Add the message to the current batch. Since
			// we're using an object we'll avoid duplicate ids in a batch
			currentBatch.set(id, {
				MessageBody: body,
				Id: id,
				DelaySeconds: delay,
				MessageAttributes: {
					attempts: {
						DataType: 'Number',
						StringValue: `${message.attempts}`,
					},
				},
			});

			messagesById.set(id, message);
		}

		/** Collection of all of the batch message promises */
		const batchPromises = [];

		/** Send each batch */
		for (const batch of messageBatches) {
			const entries = Array.from(batch.values());
			const command = new SendMessageBatchCommand({
				Entries: entries,
				QueueUrl: uris.uri,
			});
			const batchRequest = limit(() => sqs.send(command));
			batchPromises.push(batchRequest);
		}

		const batchResults = await Promise.allSettled(batchPromises);

		for (const [index, result] of batchResults.entries()) {
			/**
			 * For any rejected promises we'll go ahead and
			 * mark all messages in that batch as failed
			 */
			if (result.status === 'rejected') {
				const failedSend = messageBatches[index];
				for (const request of failedSend.values()) {
					if (!request.Id) {
						continue;
					}
					const failedMessage = messagesById.get(request.Id);
					if (!failedMessage) {
						continue;
					}
					queueResults.Failed.push({
						message: failedMessage,
						error: result.reason,
					});
				}
			} else {
				/**
				 * Otherwise we'll individually gather
				 * any failed or successful responses
				 */
				if (result.value.Failed) {
					for (const failedSend of result.value.Failed) {
						if (!failedSend.Id) {
							continue;
						}
						const failedMessage = messagesById.get(failedSend.Id);
						if (!failedMessage) {
							continue;
						}
						queueResults.Failed.push({
							error: failedSend,
							message: failedMessage,
						});
					}
				}
				if (result.value.Successful) {
					for (const successfulSend of result.value.Successful) {
						if (!successfulSend.Id) {
							continue;
						}
						const successfulMessage = messagesById.get(successfulSend.Id);
						if (!successfulMessage) {
							continue;
						}
						queueResults.Sent.push(successfulMessage);
					}
				}
			}
		}

		return queueResults;
	}
}

export function QueueHandler<T = unknown>(
	options: QueueHandlerOptions<T>,
	handler: AsyncHandler<QueueHandlerEvent<T>, QueueHandlerResponse<T>>,
): QueueHandlerWithDefinition<T> {
	const { validator, sqs, ...definition } = options;

	const maximumAttempts = definition.maximumAttempts ?? 10;
	definition.maximumAttempts = maximumAttempts;

	const wrappedHandler: SQSHandler = async (event, context) => {
		const queueEvent: QueueHandlerEvent<T> = {
			Records: event.Records,
			InvalidMessages: [],
			ValidMessages: [],
		};
		for (const record of event.Records) {
			const attempts = getAttemptsFromMessageAttribute(
				record.messageAttributes.attempts,
			);
			/**
			 * Try to validate all of the message bodies
			 */
			try {
				const parsedBody = JSON.parse(record.body);
				if (validator) {
					const validBody = validator(parsedBody);
					queueEvent.ValidMessages.push({
						body: validBody,
						messageId: record.messageId,
						attempts: attempts,
					});
				}
			} catch (error) {
				queueEvent.InvalidMessages.push({
					attempts: attempts,
					body: record.body,
					error: error,
					messageId: record.messageId,
				});
			}
		}

		try {
			/**
			 * Run the queue handler against the validated or invalid messages
			 */
			const handlerResponse = await handler(queueEvent, context);
			/**
			 * If there's no messages to retry we'll just return
			 */
			if (!handlerResponse || handlerResponse.retry.length === 0) {
				return {
					batchItemFailures: [],
				};
			}
			const messagesToRetry: ValidatedMessage<T>[] = [];
			const permanentlyFailedMessages: SQSBatchItemFailure[] = [];
			for (const messageToRetry of handlerResponse.retry) {
				if (messageToRetry.attempts > maximumAttempts) {
					permanentlyFailedMessages.push({
						itemIdentifier: messageToRetry.messageId,
					});
				} else {
					messagesToRetry.push(messageToRetry);
				}
			}
			/**
			 * Otherwise we'll re-queue any messages that failed to retry
			 */
			await QueueManager.send(sqs, definition.queueName, messagesToRetry);
			return {
				batchItemFailures: permanentlyFailedMessages,
			};
		} catch (error) {
			console.error(error);
			/**
			 * If the handler fails to run we'll mark all of the events
			 * as failed and return them
			 */
			return {
				batchItemFailures: event.Records.map((record) => ({
					itemIdentifier: record.messageId,
				})),
			};
		}
	};

	return Object.assign(wrappedHandler, {
		type: HandlerTypes.Queue as const,
		definition: definition,
		sendMessages: async (messages: Message<T>[]) => {
			return QueueManager.send(sqs, definition.queueName, messages);
		},
	});
}

/**
 * Helper function to get the number of attempts
 * from the message attribute of an SQS function
 * @param attribute
 * @returns
 */
function getAttemptsFromMessageAttribute(
	attribute?: SQSMessageAttribute,
): number {
	if (!attribute) {
		return Infinity;
	}

	const attributeValue = Number(attribute.stringValue);
	if (Number.isNaN(attributeValue)) {
		return 0;
	}

	return attributeValue;
}
