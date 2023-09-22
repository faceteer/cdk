import { getJwtClaimArrayValueFromString } from './get-jwt-claim-array-value-from-string';

describe('get-jwt-claim-array-value-from-string', () => {
	it('properly parses out valid claim input', () => {
		const result = getJwtClaimArrayValueFromString('[1 2 3]');

		console.log(result);
		expect(result.length).toBe(3);
		expect(result[0]).toBe('1');
		expect(result[2]).toBe('3');
	});
	it('should throw if value does not appear to be the expected AWS array type', () => {
		try {
			getJwtClaimArrayValueFromString('1 2 3');
		} catch (error) {
			return expect(true).toBe(true);
		}
		expect(true).toBe(false);
	});
});
