import * as path from 'path';
import { extractHandlers } from '../../extract/extract-handlers';

jest.spyOn(global.console, 'error');

describe('Parse Handlers', () => {
	test('Handlers are parsed', () => {
		const handlers = extractHandlers(path.join(__dirname, '../../fixtures/'));

		const basePath = path.join(__dirname, '../../fixtures/');

		expect(console.error).toBeCalledWith(
			`Failed to parse handler: ${basePath}api/test-bad.handler.ts`,
		);

		expect(handlers.api).toEqual({
			'GET-users-{userId}': {
				method: 'GET',
				route: '/users/{userId}',
				pathParameters: ['userId'],
				description: 'Get a user',
				memorySize: 512,
				name: 'GET-users-{userId}',
				path: `${basePath}api/test-get.handler.ts`,
				validators: undefined,
				schemas: {
					body: {
						type: 'object',
						properties: {
							userId: {
								type: 'string',
							},
							email: {
								type: 'string',
							},
						},
						required: ['email', 'userId'],
					},
				},
			},
			'POST-users': {
				method: 'POST',
				route: '/users',
				description: 'Create a user',
				memorySize: 256,
				disableAuth: true,
				timeout: 900,
				name: 'POST-users',
				path: `${basePath}api/test-post.handler.ts`,
				schemas: undefined,
				validators: {
					body: expect.any(Function),
					response: expect.any(Function),
				},
			},
		});

		expect(handlers.queue).toEqual({
			QueueUpdateUser: {
				queueName: 'updateUser',
				memorySize: 1024,
				timeout: 900,
				maxBatchingWindow: 10,
				maximumAttempts: 10,
				name: 'QueueUpdateUser',
				path: `${basePath}queue/test-queue.handler.ts`,
			},
		});

		expect(handlers.cron).toEqual({
			QueuePulls: {
				name: 'QueuePulls',
				schedule: {
					expressionString: 'cron(0 4 * * ? *)',
				},
				path: `${basePath}cron/test-cron.handler.ts`,
			},
		});

		expect(handlers.notification).toEqual({
			IncomingEmailSendToProcessQueue: {
				name: 'IncomingEmailSendToProcessQueue',
				topicName: 'incoming-email',
				memorySize: 256,
				path: `${basePath}notification/test-notification.handler.ts`,
			},
		});
	});
});

export {};
