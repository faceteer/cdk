import { camelCase, pascalCase } from 'change-case';
import ejs from 'ejs';
import path from 'path';
import { extractHandlers, FullHandlerDefinition } from '../../extract';
import { ApiHandlerDefinition } from '../../handlers';
import fs from 'fs';
import { printNode, zodToTs } from 'zod-to-ts';
import { z } from 'zod';

const getPackageJson = ({ packageName }: { packageName: string }) => {
	return ejs.renderFile('codegen/client/templates/package.ejs', {
		packageName,
	});
};

const getTSConfig = () => {
	return ejs.renderFile('codegen/client/templates/tsconfig.ejs');
};

const getBaseResponse = ({ serviceName }: { serviceName: string }) => {
	return ejs.renderFile('codegen/client/templates/base-response.ejs', {
		serviceName,
	});
};

const getServiceClass = ({
	serviceName,
	handlers,
}: {
	serviceName: string;
	handlers: FullHandlerDefinition<ApiHandlerDefinition<never, never, never>>[];
}) => {
	return ejs.renderFile('codegen/client/templates/class.ejs', {
		serviceName,
		functionNames: handlers.map(({ name }) => camelCase(name)),
	});
};

const getRequestCode = ({
	serviceName,
	handler,
}: {
	serviceName: string;
	handler: FullHandlerDefinition<ApiHandlerDefinition<never, never, never>>;
}) => {
	let requestType = '';
	let requestSupplier = '';
	if (handler.pathParameters) {
		for (const param of handler.pathParameters) {
			requestType += `	${param}: string;\n`;
			requestSupplier += `${param},`;
		}
		requestSupplier = `const { ${requestSupplier.slice(0, -1)} } = request;`;
	}
	return ejs.renderFile('codegen/client/templates/request.ejs', {
		serviceName,
		functionName: camelCase(handler.name),
		requestName: pascalCase(`${handler.name}Request`),
		requestType: requestType ? `{\n${requestType}}` : '{}',
		responseName: pascalCase(`${handler.name}Response`),
		responseType: '{}',
		requestSupplier,
		route: handler.route.replace(/{/g, '${'),
		method: handler.method,
	});
};

const getMakeRequest = ({ serviceName }: { serviceName: string }) => {
	return ejs.renderFile('codegen/client/templates/make-request.ejs', {
		serviceName,
	});
};

async function generateClient() {
	const { api } = extractHandlers(path.join(__dirname, '../../fixtures/'));
	const handlers = Object.values(api);
	handlers.forEach((handler) => {
		handler.name = handler.name.replace('Api', '');
	});
	const serviceName = pascalCase('Test');

	await fs.rmSync('client', { recursive: true, force: true });

	await fs.mkdirSync('client');
	await fs.mkdirSync('client/requests');
	await fs.mkdirSync('client/types');

	const classCode = await getServiceClass({ serviceName, handlers });
	await fs.writeFileSync(`client/src/${serviceName}.ts`, classCode);
	const packageCode = await getPackageJson({ packageName: '@tailwind/test' });
	await fs.writeFileSync('client/package.json', packageCode);
	const tsconfigCode = await getTSConfig();
	await fs.writeFileSync('client/tsconfig.json', tsconfigCode);
	const baseResponseCode = await getBaseResponse({ serviceName });
	await fs.writeFileSync('client/types/base-response.ts', baseResponseCode);

	const promises = Object.values(handlers).map(async (handler) => {
		const code = await getRequestCode({ serviceName, handler });
		await fs.writeFileSync(
			`client/src/requests/${camelCase(handler.name)}.ts`,
			code,
		);
	});
	await Promise.all(promises);
}

generateClient();
