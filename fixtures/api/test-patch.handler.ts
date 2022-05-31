import { z } from 'zod';
import { ApiHandler } from '../../handlers/api-handler';
import { SuccessResponse } from '../../response/success-response';

const BodySchema = z.object({
	userId: z.string().optional(),
	email: z.string().optional(),
});

const ResponseSchema = z.object({
	userId: z.string(),
	email: z.string(),
});

export const handler = ApiHandler(
	{
		name: 'patchUser',
		method: 'PATCH',
		route: '/users',
		description: 'Patch a user',
		memorySize: 256,
		disableAuth: true,
		timeout: 900,
		schemas: {
			body: BodySchema,
			response: ResponseSchema,
		},
	},
	async (event) => {
		console.log(event);

		return SuccessResponse(event.input.body);
	},
);
