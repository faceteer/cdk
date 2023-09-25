import { NotificationHandler } from '../../../handlers';

type IncomingEmail = {
	type: 'incoming';
	subject: string;
	from: string;
	to: string;
	content: string;
	sentAt: Date;
};

type OutgoingEmail = {
	type: 'outgoing';
	subject: string;
	from: string;
	to: string;
	content: string;
	id: string;
};

export const handler = NotificationHandler(
	{
		name: 'send-to-process-queue',
		topics: ['incoming-email', 'outgoing-email'],
		validator: (topicName, messageBody) => {
			if (topicName === 'incoming-email') {
				return messageBody as IncomingEmail;
			}
			return messageBody as OutgoingEmail;
		},
		memorySize: 256,
	},
	async (event) => {
		event.ValidMessages[0]!.body;
		console.log(event.ValidMessages.length);
		return;
	},
);
