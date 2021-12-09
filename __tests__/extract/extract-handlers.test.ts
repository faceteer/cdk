import * as path from 'path';
import { extractHandlers } from '../../extract/extract-handlers';

describe('Parse Handlers', () => {
	test('Handlers are parsed', () => {
		const handlers = extractHandlers(path.join(__dirname, '../test-handlers/'));

		Object.entries(handlers.api).forEach(([path, definition]) => {
			expect(path.endsWith('test-api.handler.ts')).toBeTruthy();
			expect(definition.memorySize).toBe(512);
		});
	});
});

export {};
