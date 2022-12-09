import * as path from 'path';
import { extractHandlers } from '../../extract/extract-handlers';

jest.spyOn(global.console, 'error');

describe('Parse Handlers', () => {
	test('Handlers are parsed', () => {
		const handlers = extractHandlers(path.join(__dirname, '../../fixtures/'));

		const basePath = path.join(__dirname, '../../fixtures/');

		expect(handlers.api).toEqual({
			ApiGetUser: {
				method: 'GET',
				route: '/users/{userId}',
				pathParameters: ['userId'],
				description: 'Get a user',
				memorySize: 512,
				name: 'ApiGetUser',
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
			ApiGetUsere3a216: {
				method: 'GET',
				route: '/other-users/{userId}',
				pathParameters: ['userId'],
				description: 'Get some other user',
				memorySize: 512,
				name: 'ApiGetUsere3a216',
				path: `${basePath}api/test-is-duplicate.handler.ts`,
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
			ApiCreateUser: {
				method: 'POST',
				route: '/users',
				description: 'Create a user',
				memorySize: 256,
				disableAuth: true,
				timeout: 900,
				name: 'ApiCreateUser',
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

		expect(handlers.event).toEqual({
			EventUserAddedEvent: {
				name: 'EventUserAddedEvent',
				eventPattern: {
					detailType: ['Some user was added type'],
				},
				eventBusName: 'event-bus-name',
				memorySize: 1024,
				timeout: 900,
				path: `${basePath}event/test-event.handler.ts`,
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
