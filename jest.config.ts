export default {
	preset: 'ts-jest',
	testEnvironment: 'node',
	reporters: ['default', 'jest-junit'],
	testPathIgnorePatterns: [
		'^.+\\.js$',
		'/fixtures/',
		'^.+\\.d\\.ts$',
		'^.+/infrastructure/(bin|lib)/',
	],
	coveragePathIgnorePatterns: ['/fixtures/'],
	globals: {
		'ts-jest': {
			isolatedModules: true,
		},
	},
};
