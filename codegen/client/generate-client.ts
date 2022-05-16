import { camelCase, pascalCase } from 'change-case';
import ejs from 'ejs';
import path from 'path';
import { extractHandlers } from '../../extract';

async function generateClient() {
	const handlers = extractHandlers(path.join(__dirname, '../../fixtures/'));
	const name = pascalCase('Test');

	const functions = Object.keys(handlers.api).map((key) => camelCase(key));
	const classCode = await ejs.renderFile('codegen/client/templates/class.ejs', {
		name,
		functions,
	});

	const promises = Object.values(handlers.api).map((api) =>
		ejs.renderFile('codegen/client/templates/request.ejs', {
			name,
			functionName: camelCase(api.name),
			requestName: pascalCase(`${api.name}Request`),
			requestType: '{}',
			responseName: pascalCase(`${api.name}Response`),
			responseType: '{}',
			route: api.route,
			method: api.method,
		}),
	);
	const codes = await Promise.all(promises);

	console.log(classCode);
	for (const code of codes) {
		console.log('-------------------------------------------\n');
		console.log(code);
	}
}

generateClient();
