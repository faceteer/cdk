import { EventHandler } from '../../../handlers';

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
		eventBusName: 'event-bus-name',
		memorySize: 1024,
		timeout: 900,
		/**
		 * Deprecated validator
		 */
		// validator: (body) => {
		// 	return body as EventBridgeEvent<'Some user was added type', User>;
		// },
		validators: {
			type: (type) => type as 'Some user was added type',
			detail: (detail) => detail as User,
		},
	},
	async (event) => {
		console.log(event.detail);
		console.log(event['detail-type']);
	},
);
