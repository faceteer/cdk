import { routeToAlphaNumeric } from '../../util/route-to-alphanumeric';

describe('route-to-alphanumeric', () => {
	it('Should strip out / characters', () => {
		const route = '/foo/bar';
		expect(routeToAlphaNumeric(route)).not.toContain('/');
	});

	it('Should strip out {} characters', () => {
		const route = '/foo/{bar}';
		expect(routeToAlphaNumeric(route)).not.toContain('{');
		expect(routeToAlphaNumeric(route)).not.toContain('}');
	});

	it('Should strip out space characters', () => {
		const route = 'GET /foo/bar';
		expect(routeToAlphaNumeric(route)).not.toContain(' ');
	});

	it('should have distinct results for unique routes', () => {
		const routeA = 'GET /foo/bar';
		const routeB = 'POST /foo/bar';
		const routeC = 'GET /foobar';
		const routeD = 'GET /foo/{bar}';

		const expectToBeDifferent = (a: string, b: string) =>
			routeToAlphaNumeric(a) !== routeToAlphaNumeric(b);
		expectToBeDifferent(routeA, routeB);
		expectToBeDifferent(routeA, routeC);
		expectToBeDifferent(routeA, routeD);
		expectToBeDifferent(routeC, routeD);
	});
});

export {};
