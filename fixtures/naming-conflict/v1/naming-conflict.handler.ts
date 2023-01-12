import { ApiHandler } from '../../../handlers/api-handler';
import { SuccessResponse } from '../../../response/success-response';
import type { JSONSchemaType } from 'ajv';

interface User {
	userId: string;
	email: string;
}

const UserSchema: JSONSchemaType<User> = {
	type: 'object',
	properties: {
		userId: { type: 'string' },
		email: { type: 'string' },
	},
	required: ['email', 'userId'],
};

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
		console.log(event);

		return SuccessResponse({ success: 'true' });
	},
);
