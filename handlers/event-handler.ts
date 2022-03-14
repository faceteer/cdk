import { EventPattern } from 'aws-cdk-lib/aws-events';
import type {
	EventBridgeEvent,
	SQSHandler,
	SQSMessageAttribute,
	SQSRecord,
} from 'aws-lambda';
import { AsyncHandler, HandlerDefinition, HandlerTypes } from './handler';
import type { InvalidMessage, Message, ValidatedMessage } from './message';

export interface EventHandlerDefinition extends HandlerDefinition {
	/**
	 * Event handler name
	 */
	name: string;

	/**
	 * Uses event bus name that is provided and configured within stack.
	 * If no name is specified, the first bus listed in the CDK configuration is used.
	 */
	eventBusName?: string;

	/**
	 * The event pattern in which to subscribe to.
	 */
	eventPattern: EventPattern;

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

export type EventHandlerEvent<T> = {
	/**
	 * The raw SQS records
	 */
	Records: SQSRecord[];
	/**
	 * Messages that have been validated
	 */
	ValidMessages: ValidatedMessage<EventBridgeEvent<string, T>>[];
	/**
	 * Messages that failed to validate
	 */
	InvalidMessages: InvalidMessage[];
};

export interface EventHandlerOptions<T> extends EventHandlerDefinition {
	validator?: (
		messageBody: EventBridgeEvent<string, any>,
	) => EventBridgeEvent<string, T>;
}

export type EventHandlerWithDefinition = SQSHandler & {
	type: HandlerTypes.Event;
	definition: EventHandlerDefinition;
};

export function EventHandler<T = unknown>(
	options: EventHandlerOptions<T>,
	handler: AsyncHandler<EventHandlerEvent<T>, void>,
): EventHandlerWithDefinition {
	const { validator, ...definition } = options;

	const maximumAttempts = definition.maximumAttempts ?? 10;
	definition.maximumAttempts = maximumAttempts;

	const wrappedHandler: SQSHandler = async (event, context) => {
		const queueEvent: EventHandlerEvent<T> = {
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
			await handler(queueEvent, context);
		} catch (error) {
			console.error(error);
		}
	};

	return Object.assign(wrappedHandler, {
		type: HandlerTypes.Event as const,
		definition: definition,
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
