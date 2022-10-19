/* eslint-disable @typescript-eslint/no-unused-vars */
import {
	QueueHandler,
	QueueHandlerEvent,
	QueueHandlerResponse,
	QueueManager,
} from '../../handlers';
import type {
	SendMessageBatchCommand,
	SendMessageBatchResult,
	SQSClient,
} from '@aws-sdk/client-sqs';
import { SQSRecord } from 'aws-lambda';
import { isFifoMessage, Message } from '../../handlers/message';

const mockSend = jest.fn(
	async (command: SendMessageBatchCommand): Promise<SendMessageBatchResult> => {
		const response: SendMessageBatchResult = {
			Failed: [],
			Successful: [],
		};

		if (command.input.Entries) {
			for (const entry of command.input.Entries) {
				if (entry.MessageBody?.includes('failed')) {
					response.Failed?.push({
						Id: entry.Id,
						Code: '500',
						SenderFault: true,
					});
				} else {
					response.Successful?.push({
						Id: entry.Id,
						MessageId: entry.Id,
						MD5OfMessageBody: entry.MessageBody,
					});
				}
			}
		}
		return response;
	},
);
const sqs = {
	/**
	 * Returns a failed message if the body
	 * includes the text failed
	 */
	send: mockSend,
} as unknown as SQSClient;

interface PullUserEvent {
	userId: string;
	token: string;
}

describe('Queue Handler', () => {
	beforeEach(() => {
		mockSend.mockClear();
		process.env = {
			...process.env,
			QUEUE_TEST_QUEUE: 'test-queue',
			DLQ_TEST_QUEUE: 'test-queue-dlq',
			ACCOUNT_ID: '156745',
			AWS_REGION: 'us-east-1',
		};
	});

	/**
	 * Make sure that we correctly pass through message
	 * bodies, validate them, and that we don't queue up any
	 * retries if the response is valid
	 */
	test('Successful Results Process', async () => {
		const user1 = { userId: '454', token: 'xxyyyzzz' };
		const user2 = { userId: '5657', token: 'aabbcc' };

		const internalHandler = jest.fn(
			async (
				event: QueueHandlerEvent<PullUserEvent>,
			): Promise<QueueHandlerResponse<PullUserEvent>> => {
				expect(event.ValidMessages.length).toBe(2);
				expect(event.ValidMessages[0].body).toEqual(user1);
				expect(event.ValidMessages[1].body).toEqual(user2);
				return;
			},
		);

		const handler = QueueHandler(
			{
				queueName: 'test-queue',
				sqs: sqs,
				validator: (body) => {
					return body as PullUserEvent;
				},
			},
			internalHandler,
		);

		const results = await handler(
			{
				Records: [mockSqsRecord(user1), mockSqsRecord(user2)],
			},
			{} as any,
			() => {},
		);

		expect(internalHandler).toBeCalled();
		expect(mockSend).toBeCalledTimes(0);
		if (results) {
			expect(results.batchItemFailures.length).toBe(0);
		}
	});

	test('Failed results are re-queued', async () => {
		const user1 = { userId: '454', token: 'xxyyyzzz' };
		const user2 = { userId: '5657', token: 'aabbcc' };

		const internalHandler = jest.fn(
			async (
				event: QueueHandlerEvent<PullUserEvent>,
			): Promise<QueueHandlerResponse<PullUserEvent>> => {
				const [, secondMessage] = event.ValidMessages;
				return {
					retry: [secondMessage],
				};
			},
		);

		const handler = QueueHandler(
			{
				queueName: 'test-queue',
				sqs: sqs,
				validator: (body) => {
					return body as PullUserEvent;
				},
			},
			internalHandler,
		);

		const results = await handler(
			{
				Records: [mockSqsRecord(user1), mockSqsRecord(user2)],
			},
			{} as any,
			() => {},
		);

		expect(internalHandler).toBeCalled();
		expect(mockSend).toBeCalled();
		if (results) {
			expect(results.batchItemFailures.length).toBe(0);
		}
	});

	test('Failed results permanently fail', async () => {
		const user1 = { userId: '454', token: 'xxyyyzzz' };
		const user2 = { userId: '5657', token: 'aabbcc' };

		const internalHandler = jest.fn(
			async (
				event: QueueHandlerEvent<PullUserEvent>,
			): Promise<QueueHandlerResponse<PullUserEvent>> => {
				const [, secondMessage] = event.ValidMessages;
				return {
					retry: [secondMessage],
				};
			},
		);

		const handler = QueueHandler(
			{
				queueName: 'test-queue',
				sqs: sqs,
				validator: (body) => {
					return body as PullUserEvent;
				},
			},
			internalHandler,
		);

		const results = await handler(
			{
				Records: [mockSqsRecord(user1), mockSqsRecord(user2, 100)],
			},
			{} as any,
			() => {},
		);

		expect(internalHandler).toBeCalled();
		expect(mockSend).toBeCalledTimes(0);
		if (results) {
			expect(results.batchItemFailures.length).toBe(1);
		}
	});

	test('Queue Batches Items', async () => {
		const pullUserEvents: Message<PullUserEvent>[] = [];

		for (let index = 0; index < 1000; index++) {
			if (index >= 900) {
				pullUserEvents.push({
					attempts: 0,
					body: { userId: `${index}-failed`, token: Date.now().toString(16) },
				});
			} else {
				pullUserEvents.push({
					attempts: 0,
					body: { userId: `${index}`, token: Date.now().toString(16) },
				});
			}
		}

		const result = await QueueManager.send<PullUserEvent>(
			sqs,
			'test-queue',
			pullUserEvents,
			{ uniqueKey: 'userId' },
		);

		expect(result.Sent.length).toBe(900);
		expect(result.Failed.length).toBe(100);
		expect(mockSend).toBeCalledTimes(100);

		for (let index = 0; index < 100; index++) {
			const messages = pullUserEvents.slice(index * 10, index * 10 + 10);
			for (const message of messages) {
				expect(isFifoMessage(message)).toBe(false);
			}
			expect(mockSend.mock.calls[index][0].input).toEqual({
				Entries: messages.map((message) => ({
					DelaySeconds: 0,
					Id: message.body.userId,
					MessageAttributes: {
						attempts: { DataType: 'Number', StringValue: '1' },
					},
					MessageBody: JSON.stringify(message.body),
				})),
				QueueUrl: QueueManager.getUris('test-queue').uri,
			});
		}
	});

	test('Queue Batches Fifo Items', async () => {
		const pullUserEvents: Message<PullUserEvent>[] = [];

		for (let index = 0; index < 1000; index++) {
			if (index >= 900) {
				pullUserEvents.push({
					attempts: 0,
					body: { userId: `${index}-failed`, token: Date.now().toString(16) },
					groupId: `${index}-group-id`,
					deduplicationId: `${index}-deduplication-id`,
				});
			} else {
				pullUserEvents.push({
					attempts: 0,
					body: { userId: `${index}`, token: Date.now().toString(16) },
					groupId: `${index}-id`,
					deduplicationId: `${index}-deduplication-id`,
				});
			}
		}

		const result = await QueueManager.send<PullUserEvent>(
			sqs,
			'test-queue',
			pullUserEvents,
			{ uniqueKey: 'userId' },
		);

		expect(result.Sent.length).toBe(900);
		expect(result.Failed.length).toBe(100);
		expect(mockSend).toBeCalledTimes(100);
		for (let index = 0; index < 100; index++) {
			const messages = pullUserEvents.slice(index * 10, index * 10 + 10);
			for (const message of messages) {
				expect(isFifoMessage(message)).toBe(true);
			}
			expect(mockSend.mock.calls[index][0].input).toEqual({
				Entries: messages.map((message) => ({
					DelaySeconds: 0,
					Id: message.body.userId,
					MessageAttributes: {
						attempts: { DataType: 'Number', StringValue: '1' },
					},
					MessageBody: JSON.stringify(message.body),
					MessageDeduplicationId: isFifoMessage(message)
						? message.deduplicationId
						: 'IMPOSSIBLE',
					MessageGroupId: isFifoMessage(message)
						? message.groupId
						: 'IMPOSSIBLE',
				})),
				QueueUrl: QueueManager.getUris('test-queue').uri,
			});
		}
	});
});

let mockCounter = 0;

/**
 * Generate a mock SQS record
 * @param body
 * @param attempts
 * @returns
 */
function mockSqsRecord(body: unknown, attempts = 0): SQSRecord {
	mockCounter++;
	return {
		messageId: `${Date.now().toString(
			16,
		)}-${mockCounter}-11d6ee51-4cc7-4302-9e22-7cd8afdaadf5`,
		receiptHandle: 'AQEBBX8nesZEXmkhsmZeyIE8iQAMig7qw...',
		body: JSON.stringify(body),
		attributes: {
			ApproximateReceiveCount: '1',
			SentTimestamp: `${Date.now()}`,
			SequenceNumber: '18849496460467696128',
			MessageGroupId: '1',
			SenderId: 'AIDAIO23YVJENQZJOL4VO',
			MessageDeduplicationId: '1',
			ApproximateFirstReceiveTimestamp: `${Date.now()}`,
		},
		messageAttributes: {
			attempts: {
				dataType: 'Number',
				stringValue: `${attempts}`,
				binaryListValues: [],
				stringListValues: [],
			},
		},
		md5OfBody: 'e4e68fb7bd0e697a0ae8f1bb342846b3',
		eventSource: 'aws:sqs',
		eventSourceARN: 'arn:aws:sqs:us-east-2:123456789012:fifo.fifo',
		awsRegion: 'us-east-2',
	};
}
