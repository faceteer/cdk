import * as path from 'path';
import { extractHandlers } from '../../extract/extract-handlers';

jest.spyOn(global.console, 'error');

describe('Parse Handlers', () => {
	test('Handlers are parsed', () => {
		const handlers = extractHandlers(
			path.join(__dirname, '../../fixtures/example'),
		);

		expect(handlers.api).toEqual(
			expect.objectContaining({
				ApiGetUser: expect.objectContaining({
					method: 'GET',
					route: '/users/{userId}',
					pathParameters: ['userId'],
					description: 'Get a user',
					memorySize: 512,
					name: 'ApiGetUser',
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
				}),
				ApiGetUsere3a216: expect.objectContaining({
					method: 'GET',
					route: '/other-users/{userId}',
					pathParameters: ['userId'],
					description: 'Get some other user',
					memorySize: 512,
					name: 'ApiGetUsere3a216',
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
				}),
				ApiCreateUser: expect.objectContaining({
					method: 'POST',
					route: '/users',
					description: 'Create a user',
					memorySize: 256,
					disableAuth: true,
					timeout: 900,
					name: 'ApiCreateUser',
					schemas: undefined,
					validators: {
						body: expect.any(Function),
						response: expect.any(Function),
					},
				}),
			}),
		);

		expect(handlers.queue).toEqual(
			expect.objectContaining({
				QueueUpdateUser: expect.objectContaining({
					queueName: 'updateUser',
					memorySize: 1024,
					timeout: 900,
					maxBatchingWindow: 10,
					maximumAttempts: 10,
					name: 'QueueUpdateUser',
				}),
			}),
		);

		expect(handlers.cron).toEqual({
			QueuePulls: expect.objectContaining({
				name: 'QueuePulls',
				schedule: {
					expressionString: 'cron(0 4 * * ? *)',
				},
			}),
		});

		expect(handlers.event).toEqual({
			EventUserAddedEvent: expect.objectContaining({
				name: 'EventUserAddedEvent',
				eventPattern: {
					detailType: ['Some user was added type'],
				},
				eventBusName: 'event-bus-name',
				memorySize: 1024,
				timeout: 900,
			}),
		});

		expect(handlers.notification).toEqual({
			IncomingEmailSendToProcessQueue: expect.objectContaining({
				name: 'IncomingEmailSendToProcessQueue',
				topicName: 'incoming-email',
				memorySize: 256,
			}),
		});
	});
});

export {};
