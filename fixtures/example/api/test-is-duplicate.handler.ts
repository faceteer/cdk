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
		// The name is duplicated with `test-get.handler.ts`
		name: 'getUser',
		method: 'GET',
		route: '/other-users/{userId}',
		description: 'Get some other user',
		memorySize: 512,
		validators: {
			body: validateUser,
		},
		pathParameters: ['userId'],
		architecture: 'arm64',
		runtime: 'nodejs18.x',
	},
	async (event) => {
		console.log(event);

		return SuccessResponse({ success: 'true' });
	},
);
