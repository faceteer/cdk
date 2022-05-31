import { ApiHandler } from '../../handlers/api-handler';
import { SuccessResponse } from '../../response/success-response';
import { z } from 'zod';

const UserSchema = z.object({
	userId: z.string(),
	email: z.string(),
});

export const handler = ApiHandler(
	{
		name: 'getUser',
		method: 'GET',
		route: '/users/{userId}',
		description: 'Get a user',
		memorySize: 512,
		schemas: {
			body: UserSchema,
		},
		pathParameters: ['userId'],
	},
	async (event) => {
		console.log(event.input.body);

		return SuccessResponse({ success: 'true' });
	},
);
