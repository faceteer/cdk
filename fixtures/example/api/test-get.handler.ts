import { ApiHandler } from '../../../handlers/api-handler';
import { SuccessResponse } from '../../../response/success-response';

interface User {
	userId: string;
	email: string;
}

function validateUser(body: unknown): User {
	if (!body || typeof body !== 'object') {
		throw new Error('Body must be an object');
	}
	const { userId, email } = body as any;
	if (!userId || typeof userId !== 'string') {
		throw new Error('userId is required');
	}
	if (!email || typeof email !== 'string') {
		throw new Error('email is required');
	}
	return { userId, email };
}

export const handler = ApiHandler(
	{
		name: 'getUser',
		method: 'GET',
		route: '/users/{userId}',
		description: 'Get a user',
		memorySize: 512,
		validators: {
			body: validateUser,
		},
		pathParameters: ['userId'],
	},
	async (event) => {
		console.log(event);

		return SuccessResponse({ success: 'true' });
	},
);
