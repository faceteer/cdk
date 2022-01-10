import type { JSONSchemaType } from 'ajv';
import { ApiHandler } from '../../handlers/api-handler';
import { SuccessResponse } from '../../response/success-response';

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
		method: 'POST',
		route: '/users',
		description: 'Create a user',
		memorySize: 256,
		disableAuth: true,
		timeout: 900,
		schemas: {
			body: UserSchema,
			response: UserSchema,
		},
	},
	async (event) => {
		console.log(event);

		return SuccessResponse(event.input.body);
	},
);
