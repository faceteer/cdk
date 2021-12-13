import * as path from 'path';
import { extractHandlers } from '../../extract/extract-handlers';

describe('Parse Handlers', () => {
	test('Handlers are parsed', () => {
		const handlers = extractHandlers(path.join(__dirname, '../../fixtures/'));

		const basePath = path.join(__dirname, '../../fixtures/');

		expect(handlers.api).toEqual({
			'GET-users-{userId}': {
				method: 'GET',
				route: '/users/{userId}',
				description: 'Get a user',
				memorySize: 512,
				name: 'GET-users-{userId}',
				path: `${basePath}/api/test-get.handler.ts`,
			},
			'POST-users': {
				method: 'POST',
				route: '/users',
				description: 'Create a user',
				memorySize: 256,
				disableAuth: true,
				timeout: 900,
				name: 'POST-users',
				path: `${basePath}/api/test-post.handler.ts`,
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
				path: `${basePath}/queue/test-queue.handler.ts`,
			},
		});
	});
});

export {};
