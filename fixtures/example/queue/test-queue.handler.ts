import { QueueHandler } from '../../../handlers/queue-handler';
import { SQSClient } from '@aws-sdk/client-sqs';

interface User {
	userId: string;
	email: string;
}

export const handler = QueueHandler(
	{
		queueName: 'updateUser',
		memorySize: 1024,
		timeout: 900,
		maxBatchingWindow: 10,

		sqs: new SQSClient({ region: 'us-east-1' }),
		validator: (body: any) => {
			return body as User;
		},
	},
	async (event) => {
		return {
			retry: event.ValidMessages,
		};
	},
);
