import { ApiHandler } from '../../handlers/api-handler';
import { SuccessResponse } from '../../response/success-response';

import Ajv, { JSONSchemaType } from 'ajv';
import { invariant } from '../../util/invariant';

interface User {
	id: string;
	name: string;
}

const ajv = new Ajv({
	removeAdditional: 'all',
	coerceTypes: true,
});

const UserSchema: JSONSchemaType<User> = {
	type: 'object',
	properties: {
		id: { type: 'string' },
		name: { type: 'string' },
	},
	required: ['id', 'name'],
};

interface PutUserQuery {
	force?: boolean;
}

const PutUserQuerySchema: JSONSchemaType<PutUserQuery> = {
	type: 'object',
	properties: {
		force: { type: 'boolean', nullable: true },
	},
};

describe('Api Handler', () => {
	test('Api Handler with schemas validates', async () => {
		const requestBody = {
			id: '545467',
			name: 'jeremy',
		};

		const handler = ApiHandler(
			{
				method: 'PUT',
				route: '/users/{userId}',
				schemas: {
					body: UserSchema,
					response: UserSchema,
					query: PutUserQuerySchema,
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

	test('Api Handler with schemas validates', async () => {
		const requestBody = {
			id: '545467',
			name: 'jeremy',
		};

		const handler = ApiHandler(
			{
				method: 'PUT',
				route: '/users/{userId}',
				validators: {
					body: (body) => {
						const validate = ajv.compile(UserSchema);
						if (!validate(body)) {
							const [validationError] = validate.errors ?? [];
							throw validationError;
						} else {
							return body;
						}
					},
					query: (query) => {
						const validate = ajv.compile(PutUserQuerySchema);
						if (!validate(query)) {
							const [validationError] = validate.errors ?? [];
							throw validationError;
						} else {
							return query;
						}
					},
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

	test('Api Handler with Schemas Handles Invalid Requests', async () => {
		const handler = ApiHandler(
			{
				method: 'PUT',
				route: '/users/{userId}',
				schemas: {
					body: UserSchema,
					response: UserSchema,
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
			expect(body).toEqual({
				instancePath: '',
				schemaPath: '#/required',
				keyword: 'required',
				params: {
					missingProperty: 'id',
				},
				message: "must have required property 'id'",
			});
		}
	});

	test('Api Handler with Validators Handles Invalid Requests', async () => {
		const handler = ApiHandler(
			{
				method: 'PUT',
				route: '/users/{userId}',
				validators: {
					body: (body) => {
						const validate = ajv.compile(UserSchema);
						if (!validate(body)) {
							const [validationError] = validate.errors ?? [];
							throw validationError;
						} else {
							return body;
						}
					},
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
			expect(body).toEqual({
				instancePath: '',
				schemaPath: '#/required',
				keyword: 'required',
				params: {
					missingProperty: 'id',
				},
				message: "must have required property 'id'",
			});
		} else {
			expect('water').toBe('wet');
		}
	});

	test('Api Handler Without Validator Works', async () => {
		const handler = ApiHandler(
			{
				method: 'PUT',
				route: '/users/{userId}',
				schemas: {
					body: UserSchema,
					response: UserSchema,
				},
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
				method: 'PUT',
				route: '/users/{userId}',
				schemas: {
					body: UserSchema,
					response: UserSchema,
				},
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

	test('Returns a 400 on schema validation failures', async () => {
		const handler = ApiHandler(
			{
				method: 'PUT',
				route: '/users/{userId}',
				schemas: {
					body: UserSchema,
					response: UserSchema,
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
				method: 'GET',
				route: '/users/{userId}',
				schemas: {},
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
				method: 'GET',
				route: '/users/{userId}',
				schemas: {},
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
