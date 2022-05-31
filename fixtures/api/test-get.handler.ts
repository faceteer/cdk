import { ApiHandler } from '../../handlers/api-handler';
import { SuccessResponse } from '../../response/success-response';
import { z } from 'zod';

const UserSchema = z.object({
	userId: z.string(),
	email: z.string(),
});

const QuerySchema = z.object({
	include: z.string().optional(),
});

export const handler = ApiHandler(
	{
		name: 'getUser',
		method: 'GET',
		route: '/users/{userId}',
		description: 'Get a user',
		memorySize: 512,
		schemas: {
			query: QuerySchema,
			response: UserSchema,
		},
		pathParameters: ['userId'],
	},
	async (event) => {
		console.log(event.input.body);

		return SuccessResponse({ email: '', userId: '' });
	},
);
