import { EventHandler, EventHandlerEvent } from '../../handlers';
import { EventBridgeEvent, SQSRecord } from 'aws-lambda';

interface AddedUserEvent {
	userId: string;
	token: string;
}

describe('Event Handler', () => {
	beforeEach(() => {
		process.env = {
			...process.env,
			ACCOUNT_ID: '156745',
			AWS_REGION: 'us-east-1',
		};
	});

	test('Handles valid messages', async () => {
		const user1 = { userId: '454', token: 'xxyyyzzz' };
		const user2 = { userId: '5657', token: 'aabbcc' };

		const internalHandler = jest.fn(
			async (event: EventHandlerEvent<AddedUserEvent>): Promise<void> => {
				expect(event.ValidMessages.length).toBe(2);
				expect(event.ValidMessages[0].body.detail).toEqual(user1);
				expect(event.ValidMessages[1].body.detail).toEqual(user2);
				return;
			},
		);

		const handler = EventHandler(
			{
				name: 'test-event',
				eventPattern: {
					detailType: ['test'],
				},
				validator: (body) => {
					return body as EventBridgeEvent<string, AddedUserEvent>;
				},
			},
			internalHandler,
		);

		const results = await handler(
			{
				Records: [mockSqsEventRecord(user1), mockSqsEventRecord(user2)],
			},
			{} as any,
			() => {},
		);

		expect(internalHandler).toBeCalled();
		if (results) {
			expect(console.error).toBeCalledTimes(0);
		}
	});

	test('Handles invalid messages', async () => {
		const user1 = { userId: '454', notSupposedToBeHere: '' };
		const user2 = { userId: '5657', token: 'aabbcc' };

		const mockedUser1Event = mockSqsEventRecord(user1);

		const internalHandler = jest.fn(
			async (event: EventHandlerEvent<AddedUserEvent>): Promise<void> => {
				expect(event.ValidMessages.length).toBe(1);
				expect(event.InvalidMessages.length).toBe(1);
				expect(event.ValidMessages[0].body.detail).toEqual(user2);
				expect(event.InvalidMessages[0].body).toEqual(mockedUser1Event);
				return;
			},
		);

		const handler = EventHandler(
			{
				name: 'test-event',
				eventPattern: {
					detailType: ['test'],
				},
				validator: (body) => {
					if ('userId' in body.detail && 'token' in body.detail) {
						return body as EventBridgeEvent<string, AddedUserEvent>;
					}
					throw new Error('Validation failed');
				},
			},
			internalHandler,
		);

		const results = await handler(
			{
				Records: [mockedUser1Event, mockSqsEventRecord(user2)],
			},
			{} as any,
			() => {},
		);

		expect(internalHandler).toBeCalled();
		if (results) {
			expect(console.error).toBeCalledTimes(0);
		}
	});

	let mockCounter = 0;

	/**
	 * Generate a mock SQS Event Bridge record
	 * @param body
	 * @param attempts
	 * @returns
	 */
	function mockSqsEventRecord(detail: unknown, attempts = 0): SQSRecord {
		mockCounter++;
		return {
			messageId: `${Date.now().toString(
				16,
			)}-${mockCounter}-11d6ee51-4cc7-4302-9e22-7cd8afdaadf5`,
			receiptHandle: 'AQEBBX8nesZEXmkhsmZeyIE8iQAMig7qw...',
			body: JSON.stringify({
				version: '0',
				id: '53dc4d37-cffa-4f76-80c9-8b7d4a4d2eaa',
				'detail-type': 'Scheduled Event',
				source: 'aws.events',
				account: '123456789012',
				time: '2015-10-08T16:53:06Z',
				region: 'us-east-1',
				resources: [
					'arn:aws:events:us-east-1:123456789012:rule/my-scheduled-rule',
				],
				detail,
			}),
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
});
