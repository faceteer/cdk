import { ApiHandler } from '../../handlers/api-handler';
import { SuccessResponse } from '../../response/success-response';

interface User {
	userId: string;
	email: string;
}

export const handler = ApiHandler(
	{
		method: 'GET',
		route: '/users/{userId}',
		description: 'Get a user',
		memorySize: 512,
		validators: {
			body: (requestBody): User => {
				return {
					email: requestBody?.email ?? '',
					userId: requestBody?.userId ?? '',
				};
			},
		},
	},
	async (event) => {
		console.log(event);

		return SuccessResponse({ success: 'true' });
	},
);
