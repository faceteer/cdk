export default {
	preset: 'ts-jest',
	testEnvironment: 'node',
	reporters: ['default', 'jest-junit'],
	testPathIgnorePatterns: [
		'^.+\\.js$',
     	'/__mocks__/',
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
