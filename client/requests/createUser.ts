import { Test } from '../Test';
import { TestResponse } from '../types/base-response';

export type CreateUserRequest = {};
export type CreateUserResponse = {};

export async function createUser(
	this: Test,
	request: CreateUserRequest,
): Promise<TestResponse<CreateUserResponse>> {
	const { userId, ...data } = request;
	return this.makeRequest<CreateUserResponse>({
		method: 'POST',
		url: `/users`,
		data,
		params: { userId },
	});
}
