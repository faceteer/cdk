import { EventBridgeEvent } from 'aws-lambda';
import { EventHandler } from '../../handlers';

interface User {
	userId: string;
	email: string;
}

export const handler = EventHandler(
	{
		name: 'UserAddedEvent',
		eventPattern: {
			detailType: ['Some user was added type'],
		},
		memorySize: 1024,
		timeout: 900,
		validator: (body) => {
			return body as EventBridgeEvent<'Some user was added type', User>;
		},
	},
	async (event) => {
		console.log(event.detail);
		console.log(event['detail-type']);
	},
);
