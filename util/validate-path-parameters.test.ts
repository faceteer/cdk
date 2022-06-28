import {
	getParametersFromRoute,
	validatePathParameters,
} from './validate-path-parameters';

describe('validate-path-parameters', () => {
	test('getParametersFromRoute', () => {
		expect(getParametersFromRoute('/users')).toEqual([]);
		expect(getParametersFromRoute('/users/{userId}')).toEqual(['userId']);
		expect(getParametersFromRoute('/users/{userId}/posts')).toEqual(['userId']);
		expect(getParametersFromRoute('/users/{userId}/posts/{postId}')).toEqual([
			'userId',
			'postId',
		]);
		expect(getParametersFromRoute('/users/{userId}/posts/{postId+}')).toEqual([
			'userId',
			'postId',
		]);
	});

	test('validatePathParameters', () => {
		expect(() => validatePathParameters('/users', [])).not.toThrow();
		expect(() =>
			validatePathParameters('/users/{userId}', ['userId']),
		).not.toThrow();
		expect(() =>
			validatePathParameters('/users/{userId}/posts', ['userId']),
		).not.toThrow();
		expect(() =>
			validatePathParameters('/users/{userId}/posts/{postId}', [
				'postId',
				'userId',
			]),
		).not.toThrow();

		expect(() =>
			validatePathParameters('/users/{userId}/posts/{postId}', ['postId']),
		).toThrow();
		expect(() => validatePathParameters('/users', ['userId'])).toThrow();
	});
});
