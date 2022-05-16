import { Test } from '../Test';
import { TestResponse } from '../types/base-response';

export type GetUserRequest = {};
export type GetUserResponse = {};

export async function getUser(
	this: Test,
	request: GetUserRequest,
): Promise<TestResponse<GetUserResponse>> {
	const { userId, ...data } = request;
	return this.makeRequest<GetUserResponse>({
		method: 'GET',
		url: `/users/${userId}`,
		data,
		params: { userId },
	});
}
