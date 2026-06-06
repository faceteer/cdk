import { DynamoStreamHandler } from '../../../handlers/dynamo-stream-handler';

export const handler = DynamoStreamHandler(
	{
		tableName: 'users',
		startingPosition: 'TRIM_HORIZON',
		batchSize: 100,
		memorySize: 1024,
		timeout: 900,
	},
	async (event) => {
		for (const record of event.Records) {
			console.log(record.eventName, record.dynamodb?.Keys);
		}
		return { retry: [] };
	},
);
