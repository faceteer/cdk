export default {
	preset: 'ts-jest',
	testEnvironment: 'node',
	reporters: ['default', 'jest-junit'],
	testPathIgnorePatterns: ['^.+\\.js$', '/fixtures/'],
	coveragePathIgnorePatterns: ['/fixtures/'],
	globals: {
		'ts-jest': {
			isolatedModules: true,
		},
	},
};
