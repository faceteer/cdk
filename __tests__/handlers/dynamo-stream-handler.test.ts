import { DynamoDBRecord } from 'aws-lambda';
import { DynamoStreamHandler } from '../../handlers';

describe('DynamoDB Stream Handler', () => {
	test('Reports no failures when the handler succeeds', async () => {
		const internalHandler = jest.fn(async () => {
			return { retry: [] };
		});

		const handler = DynamoStreamHandler(
			{ tableName: 'users', startingPosition: 'TRIM_HORIZON' },
			internalHandler,
		);

		const result = await handler(
			{ Records: [mockRecord('1'), mockRecord('2')] },
			{} as any,
			() => {},
		);

		expect(internalHandler).toHaveBeenCalled();
		expect(result).toEqual({ batchItemFailures: [] });
	});

	test('Reports no failures when the handler returns void', async () => {
		const handler = DynamoStreamHandler(
			{ tableName: 'users' },
			async () => {
				return;
			},
		);

		const result = await handler(
			{ Records: [mockRecord('1')] },
			{} as any,
			() => {},
		);

		expect(result).toEqual({ batchItemFailures: [] });
	});

	test('Maps retried records to their sequence numbers', async () => {
		const handler = DynamoStreamHandler(
			{ tableName: 'users' },
			async (event) => {
				// Retry everything except the first record
				return { retry: event.Records.slice(1) };
			},
		);

		const result = await handler(
			{ Records: [mockRecord('1'), mockRecord('2'), mockRecord('3')] },
			{} as any,
			() => {},
		);

		expect(result).toEqual({
			batchItemFailures: [{ itemIdentifier: '2' }, { itemIdentifier: '3' }],
		});
	});

	test('Reports the whole batch when the handler throws', async () => {
		jest.spyOn(console, 'error').mockImplementation(() => {});

		const handler = DynamoStreamHandler({ tableName: 'users' }, async () => {
			throw new Error('boom');
		});

		const result = await handler(
			{ Records: [mockRecord('1'), mockRecord('2')] },
			{} as any,
			() => {},
		);

		expect(result).toEqual({
			batchItemFailures: [{ itemIdentifier: '1' }, { itemIdentifier: '2' }],
		});
	});

	/**
	 * Generate a mock DynamoDB stream record with the given sequence number.
	 */
	function mockRecord(sequenceNumber: string): DynamoDBRecord {
		return {
			eventID: sequenceNumber,
			eventName: 'INSERT',
			eventSource: 'aws:dynamodb',
			awsRegion: 'us-east-1',
			dynamodb: {
				SequenceNumber: sequenceNumber,
				Keys: { id: { S: sequenceNumber } },
				NewImage: { id: { S: sequenceNumber } },
				StreamViewType: 'NEW_AND_OLD_IMAGES',
			},
		};
	}
});
