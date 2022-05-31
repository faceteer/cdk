import { camelCase, pascalCase } from 'change-case';
import ejs from 'ejs';
import path from 'path';
import { extractHandlers, FullHandlerDefinition } from '../../extract';
import { ApiHandlerDefinition } from '../../handlers';
import fs from 'fs';
import { printNode, zodToTs } from 'zod-to-ts';
import { z, ZodObject, ZodRawShape } from 'zod';

const getPackageJson = ({ packageName }: { packageName: string }) => {
	return ejs.renderFile('codegen/client/templates/package.ejs', {
		packageName,
	});
};

const getTSConfig = () => {
	return ejs.renderFile('codegen/client/templates/tsconfig.ejs');
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
	let requestSchema = z.object({});
	let responseSchema = z.object({});

	if (handler.pathParameters && handler.pathParameters.length > 0) {
		requestSchema = requestSchema.merge(
			z.object(
				handler.pathParameters.reduce(
					(o, key) => ({ ...o, [key]: z.string() }),
					{},
				),
			),
		);
	}
	if (handler?.schemas?.query) {
		requestSchema = requestSchema.merge(handler.schemas.query);
	}
	if (handler?.schemas?.body) {
		requestSchema = requestSchema.merge(handler.schemas.body);
	}
	if (handler?.schemas?.response) {
		responseSchema = handler.schemas.response;
	}

	return ejs.renderFile('codegen/client/templates/request.ejs', {
		serviceName,
		functionName: camelCase(handler.name),
		requestName: pascalCase(`${handler.name}Request`),
		requestType: printNode(zodToTs(requestSchema).node),
		responseName: pascalCase(`${handler.name}Response`),
		responseType: printNode(zodToTs(responseSchema).node),
		route: handler.route.replace(/{/g, '${'),
		method: handler.method,
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

	const classCode = await getServiceClass({ serviceName, handlers });
	await fs.writeFileSync(`client/${serviceName}.ts`, classCode);
	const packageCode = await getPackageJson({ packageName: '@tailwind/test' });
	await fs.writeFileSync('client/package.json', packageCode);
	const tsconfigCode = await getTSConfig();
	await fs.writeFileSync('client/tsconfig.json', tsconfigCode);

	const promises = Object.values(handlers).map(async (handler) => {
		const code = await getRequestCode({ serviceName, handler });
		await fs.writeFileSync(
			`client/requests/${camelCase(handler.name)}.ts`,
			code,
		);
	});
	await Promise.all(promises);
}

generateClient();
