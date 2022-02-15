import { NotificationHandler } from '../../handlers';

export const handler = NotificationHandler(
	{
		name: 'send-to-process-queue',
		topicName: 'incoming-email',
		memorySize: 256,
	},
	async (event) => {
		console.log(event.ValidMessages.length);
		return;
	},
);
