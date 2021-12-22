import { ApiHandler } from '../../handlers/api-handler';
import { SuccessResponse } from '../../response/success-response';

interface User {
	id: string;
	name: string;
}

interface PutUserQuery {
	force?: boolean;
}

describe('Api Handler', () => {
	test('Api Handler validates', async () => {
		const bodyValidator = jest.fn((input: any) => {
			return input as User;
		});

		const queryValidator = jest.fn((input: any) => {
			return input as PutUserQuery;
		});

		const requestBody = {
			id: '545467',
			name: 'jeremy',
		};

		const handler = ApiHandler(
			{
				method: 'PUT',
				route: '/users/{userId}',
				validators: {
					body: bodyValidator,
					query: queryValidator,
				},
				pathParameters: ['userId'] as const,
			},
			async (event) => {
				const user = event.input.body;
				const { force = false } = event.input.query;
				expect(event.input.path.userId).toBe(requestBody.id);

				return SuccessResponse({ user, force });
			},
		);

		const response = await handler(
			{
				queryStringParameters: { force: true },
				pathParameters: {
					userId: requestBody.id,
				},
				body: JSON.stringify(requestBody),
			} as any,
			{} as any,
			() => {},
		);

		expect(response).toBeTruthy();
		expect(bodyValidator).toBeCalledWith(requestBody);
		expect(queryValidator).toBeCalledWith({ force: true });
		if (response) {
			expect(response).toEqual({
				body: JSON.stringify({
					user: requestBody,
					force: true,
				}),
				statusCode: 200,
				headers: {
					'Content-Type': 'application/json',
				},
			});
		}
	});

	test('Api Handler Handles Invalid Requests', async () => {
		const bodyValidator = jest.fn((): User => {
			throw new Error('Invalid body');
		});

		const handler = ApiHandler(
			{
				method: 'PUT',
				route: '/users/{userId}',
				validators: {
					body: bodyValidator,
				},
			},
			async (event) => {
				const user = event.input.body;

				return SuccessResponse({ user });
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
			} as any,
			{} as any,
			() => {},
		);

		expect(bodyValidator).toThrow();
		expect(response).toBeTruthy();
		if (response && typeof response !== 'string') {
			expect(response.statusCode).toEqual(500);
			const body = JSON.parse(response.body ?? '{}');
			expect(body.error.message).toEqual('Invalid body');
		}
	});

	test('Api Handler Without Validator Works', async () => {
		const handler = ApiHandler(
			{
				method: 'PUT',
				route: '/users/{userId}',
				validators: {},
			},
			async (event) => {
				return SuccessResponse({ event });
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
				validators: {},
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
});

export {};
