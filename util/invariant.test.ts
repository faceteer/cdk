import { invariant } from './invariant';

describe('invariant', () => {
	test('Throws an error when the condition is falsy', () => {
		const condition = null;
		expect(() => invariant(condition)).toThrow();
	});

	test('Asserts a condition when it is truthy', () => {
		const result:
			| { success: false }
			| { success: true; data: { message: 'ok' } } = {
			success: true,
			data: { message: 'ok' },
		};

		invariant(result.success);
		expect(result.data).toStrictEqual({ message: 'ok' });
	});
});
