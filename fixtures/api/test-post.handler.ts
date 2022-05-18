import { ApiHandler } from '../../handlers/api-handler';
import { SuccessResponse } from '../../response/success-response';

interface User {
	userId: string;
	email: string;
}

export const handler = ApiHandler(
	{
		name: 'createUser',
		method: 'POST',
		route: '/users',
		description: 'Create a user',
		memorySize: 256,
		disableAuth: true,
		timeout: 900,
		validators: {
			body: (body) => body as User,
			response: (response) => response as User,
		},
	},
	async (event) => {
		console.log(event);

		return SuccessResponse(event.input.body);
	},
);
