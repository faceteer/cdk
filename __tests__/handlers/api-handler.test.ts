import { ApiHandler } from '../../handlers/api-handler';
import { SuccessResponse } from '../../response/success-response';
import { invariant } from '../../util/invariant';

interface User {
	id: string;
	name: string;
}

interface PutUserQuery {
	force?: boolean;
}

// Simple validation functions
function validateUser(body: unknown): User {
	if (!body || typeof body !== 'object') {
		throw new Error('Body must be an object');
	}
	const { id, name } = body as any;
	if (!id || typeof id !== 'string') {
		throw new Error('id is required and must be a string');
	}
	if (!name || typeof name !== 'string') {
		throw new Error('name is required and must be a string');
	}
	return { id, name };
}

function validateQuery(query: unknown): PutUserQuery {
	if (!query || typeof query !== 'object') {
		return {};
	}
	const { force } = query as any;
	return { force: force === 'true' || force === true };
}

describe('Api Handler', () => {
	test('Api Handler with validators validates', async () => {
		const requestBody = {
			id: '545467',
			name: 'jeremy',
		};

		const handler = ApiHandler(
			{
				name: 'putUser',
				method: 'PUT',
				route: '/users/{userId}',
				validators: {
					body: validateUser,
					query: validateQuery,
				},
				pathParameters: ['userId'] as const,
			},
			async (event) => {
				const user = event.input.body;
				const { force = false } = event.input.query;
				expect(event.input.path.userId).toBe(requestBody.id);
				expect(force).toBeTruthy();

				return SuccessResponse(user);
			},
		);

		const response = await handler(
			{
				rawQueryString: 'force=true',
				pathParameters: {
					userId: requestBody.id,
				},
				body: JSON.stringify(requestBody),
			} as any,
			{} as any,
			() => {},
		);

		expect(response).toBeTruthy();
		if (response) {
			expect(response).toEqual({
				body: JSON.stringify(requestBody),
				statusCode: 200,
				headers: {
					'Content-Type': 'application/json',
				},
			});
		}
	});

	test('Api Handler with validators validates with query', async () => {
		const requestBody = {
			id: '545467',
			name: 'jeremy',
		};

		const handler = ApiHandler(
			{
				name: 'putUser',
				method: 'PUT',
				route: '/users/{userId}',
				validators: {
					body: validateUser,
					query: validateQuery,
				},
				pathParameters: ['userId'] as const,
			},
			async (event) => {
				const user = event.input.body;
				const { force = false } = event.input.query;
				expect(event.input.path.userId).toBe(requestBody.id);
				expect(force).toBeTruthy();

				return SuccessResponse(user);
			},
		);

		const response = await handler(
			{
				rawQueryString: 'force=true',
				pathParameters: {
					userId: requestBody.id,
				},
				body: JSON.stringify(requestBody),
			} as any,
			{} as any,
			() => {},
		);

		expect(response).toBeTruthy();
		if (response) {
			expect(response).toEqual({
				body: JSON.stringify(requestBody),
				statusCode: 200,
				headers: {
					'Content-Type': 'application/json',
				},
			});
		}
	});

	test('Api Handler with validators still validates with empty query', async () => {
		const requestBody = {
			id: '545467',
			name: 'jeremy',
		};

		const handler = ApiHandler(
			{
				name: 'putUser',
				method: 'PUT',
				route: '/users/{userId}',
				validators: {
					body: validateUser,
					query: validateQuery,
				},
				pathParameters: ['userId'] as const,
			},
			async (event) => {
				const user = event.input.body;
				expect(event.input.path.userId).toBe(requestBody.id);
				expect(event.input.query.force).toBeFalsy();

				return SuccessResponse(user);
			},
		);

		const response = await handler(
			{
				pathParameters: {
					userId: requestBody.id,
				},
				body: JSON.stringify(requestBody),
			} as any,
			{} as any,
			() => {},
		);

		expect(response).toBeTruthy();
		if (response) {
			expect(response).toEqual({
				body: JSON.stringify(requestBody),
				statusCode: 200,
				headers: {
					'Content-Type': 'application/json',
				},
			});
		}
	});

	test('Api Handler with Validators Handles Invalid Requests', async () => {
		const handler = ApiHandler(
			{
				name: 'putUser',
				method: 'PUT',
				route: '/users/{userId}',
				validators: {
					body: validateUser,
				},
			},
			async (event) => {
				const user = event.input.body;

				return SuccessResponse(user);
			},
		);
		const requestBody = {
			bad: 'key',
		};

		const response = await handler(
			{
				queryStringParameters: { force: true },
				body: JSON.stringify(requestBody),
			} as any,
			{} as any,
			() => {},
		);

		expect(response).toBeTruthy();
		if (response && typeof response !== 'string') {
			expect(response.statusCode).toEqual(400);
			const body = JSON.parse(response.body ?? '{}');
			expect(body.message).toContain('id is required');
		}
	});

	test('Api Handler with Validators Handles Invalid Requests', async () => {
		const handler = ApiHandler(
			{
				name: 'putUser',
				method: 'PUT',
				route: '/users/{userId}',
				validators: {
					body: validateUser,
				},
			},
			async (event) => {
				const user = event.input.body;

				return SuccessResponse(user);
			},
		);
		const requestBody = {
			bad: 'key',
		};

		const response = await handler(
			{
				queryStringParameters: { force: true },
				body: JSON.stringify(requestBody),
			} as any,
			{} as any,
			() => {},
		);

		expect(response).toBeTruthy();
		if (response && typeof response !== 'string') {
			expect(response.statusCode).toEqual(400);
			const body = JSON.parse(response.body ?? '{}');
			expect(body.message).toContain('id is required');
		} else {
			expect('water').toBe('wet');
		}
	});

	test('Api Handler Without Validator Works', async () => {
		const handler = ApiHandler(
			{
				name: 'putUser',
				method: 'PUT',
				route: '/users/{userId}',
				pathParameters: ['userId'] as const,
			},
			async (event) => {
				return SuccessResponse(event.input.body);
			},
		);
		const requestBody = {
			id: '545467',
			name: 'jeremy',
		};

		const response = await handler(
			{
				queryStringParameters: { force: true },
				body: JSON.stringify(requestBody),
				pathParameters: {
					userId: '545467',
				},
			} as any,
			{} as any,
			() => {},
		);

		expect(response).toBeTruthy();
	});

	test('Invalid handler returns failed response', async () => {
		const invalidHandler: any = () => {
			return;
		};
		const handler = ApiHandler(
			{
				name: 'putUser',
				method: 'PUT',
				route: '/users/{userId}',
				pathParameters: ['userId'] as const,
			},
			invalidHandler,
		);
		const requestBody = {
			id: '545467',
			name: 'jeremy',
		};

		const response = await handler(
			{
				queryStringParameters: { force: true },
				body: JSON.stringify(requestBody),
				pathParameters: {
					userId: '545467',
				},
			} as any,
			{} as any,
			() => {},
		);

		expect(response).toBeTruthy();
		if (response && typeof response !== 'string') {
			expect(response.statusCode).toEqual(500);
			const body = JSON.parse(response.body ?? '{}');
			expect(body.error.message).toEqual(
				'The API handler return an invalid response type',
			);
		}
	});

	test('Returns a 400 on validation failures', async () => {
		const handler = ApiHandler(
			{
				name: 'putUser',
				method: 'PUT',
				route: '/users/{userId}',
				validators: {
					body: validateUser,
				},
				pathParameters: ['userId'] as const,
			},
			async (event) => {
				return SuccessResponse(event.input.body);
			},
		);
		const requestBody = {
			id: '545467',
		};

		const response = await handler(
			{
				queryStringParameters: { force: true },
				body: JSON.stringify(requestBody),
				pathParameters: {
					userId: '545467',
				},
			} as any,
			{} as any,
			() => {},
		);

		invariant(response && typeof response !== 'string');
		expect(response.statusCode).toBe(400);
	});

	test('Returns a 400 on validator validation failures', async () => {
		const handler = ApiHandler(
			{
				name: 'putUser',
				method: 'PUT',
				route: '/users/{userId}',
				validators: {
					body: (body) => {
						if (
							body &&
							typeof body === 'object' &&
							'name' in body &&
							'id' in body
						) {
							return body as User;
						} else {
							throw new Error('Missing an attribute!');
						}
					},
				},
				pathParameters: ['userId'] as const,
			},
			async (event) => {
				return SuccessResponse(event.input.body);
			},
		);
		const requestBody = {
			id: '545467',
		};

		const response = await handler(
			{
				queryStringParameters: { force: true },
				body: JSON.stringify(requestBody),
				pathParameters: {
					userId: '545467',
				},
			} as any,
			{} as any,
			() => {},
		);

		invariant(response && typeof response !== 'string');
		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body ?? '')).toEqual({
			message: 'Missing an attribute!',
		});
	});

	test('Authorizer rejects request when it returns false', async () => {
		const handler = ApiHandler(
			{
				name: 'getUser',
				method: 'GET',
				route: '/users/{userId}',
				pathParameters: ['userId'] as const,
				authorizer: () => false,
			},
			async () => {
				return SuccessResponse('testing');
			},
		);

		const response = await handler(
			{
				queryStringParameters: { force: true },
				pathParameters: {
					userId: '545467',
				},
			} as any,
			{} as any,
			() => {},
		);

		invariant(response && typeof response !== 'string');
		expect(response.statusCode).toEqual(403);
	});

	test('Authorizer return value is attached to input value', async () => {
		const userId = '545467';

		const handler = ApiHandler(
			{
				name: 'getUser',
				method: 'GET',
				route: '/users/{userId}',
				pathParameters: ['userId'] as const,
				authorizer: (event) => {
					return event.input.path.userId;
				},
			},
			async (event) => {
				return SuccessResponse({ userId: event.input.auth });
			},
		);

		const response = await handler(
			{
				queryStringParameters: { force: true },
				pathParameters: {
					userId: userId,
				},
			} as any,
			{} as any,
			() => {},
		);

		invariant(response && typeof response !== 'string' && response.body);
		expect(JSON.parse(response.body)).toStrictEqual({ userId: userId });
	});

	test('When the authorizer function throws, it will return a 403', async () => {
		const handler = ApiHandler(
			{
				name: 'getTest',
				method: 'GET',
				route: '/test',
				authorizer: () => {
					throw new Error('an error!!');
				},
			},
			async () => {
				return SuccessResponse({});
			},
		);

		const response = await handler(
			{
				queryStringParameters: { force: true },
			} as any,
			{} as any,
			() => {},
		);

		invariant(response && typeof response !== 'string' && response.body);
		expect(response.statusCode).toBe(403);
	});
});

export {};