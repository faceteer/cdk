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
		// The name is duplicated with `test-get.handler.ts`
		name: 'getUser',
		method: 'GET',
		route: '/other-users/{userId}',
		description: 'Get some other user',
		memorySize: 512,
		schemas: {
			body: UserSchema,
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
