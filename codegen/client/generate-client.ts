import { camelCase, pascalCase } from 'change-case';
import ejs from 'ejs';
import path from 'path';
import { extractHandlers, FullHandlerDefinition } from '../../extract';
import { ApiHandlerDefinition } from '../../handlers';
import fs from 'fs';
import { printNode, zodToTs } from 'zod-to-ts';
import { z } from 'zod';

const writeServiceClass = async ({
	serviceName,
	handlers,
}: {
	serviceName: string;
	handlers: FullHandlerDefinition<ApiHandlerDefinition<never, never, never>>[];
}) => {
	const code = await ejs.renderFile('codegen/client/templates/class.ejs', {
		serviceName,
		functionNames: handlers.map(({ name }) => camelCase(name)),
	});

	await fs.writeFileSync(`client/src/${serviceName}.ts`, code);
};

const writeRequestCode = async ({
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

	const code = await ejs.renderFile('codegen/client/templates/request.ejs', {
		serviceName,
		functionName: camelCase(handler.name),
		requestName: pascalCase(`${handler.name}Request`),
		requestType: printNode(zodToTs(requestSchema).node).replace(/ {4}/g, '	'),
		responseName: pascalCase(`${handler.name}Response`),
		responseType: printNode(zodToTs(responseSchema).node).replace(/ {4}/g, '	'),
		route: handler.route.replace(/{/g, '${'),
		method: handler.method,
	});

	await fs.writeFileSync(
		`client/src/requests/${camelCase(handler.name)}.ts`,
		code,
	);
};

const writeTemplateFile = async ({
	data,
	template,
	output,
}: {
	data: { serviceName: string; packageName: string };
	template: string;
	output: string;
}) => {
	const code = await ejs.renderFile(
		`codegen/client/templates/${template}`,
		data,
	);
	await fs.writeFileSync(output, code);
};

async function generateClient() {
	const { api } = extractHandlers(path.join(__dirname, '../../fixtures/'));
	const handlers = Object.values(api);
	handlers.forEach((handler) => {
		handler.name = handler.name.replace('Api', '');
	});
	const serviceName = pascalCase('Test');

	await fs.rmSync('client', { recursive: true, force: true });

	/**
	 * Prep client directory
	 */
	await Promise.all([
		fs.mkdirSync('client'),
		fs.mkdirSync('client/src'),
		fs.mkdirSync('client/src/requests'),
		fs.mkdirSync('client/src/helpers'),
		fs.mkdirSync('client/src/types'),
	]);

	/**
	 * Write necessary helper files
	 */
	const data = {
		serviceName,
		packageName: '@tailwind/test',
		baseURL: 'https://test.tailwindapp.net',
	};
	await Promise.all([
		writeServiceClass({ serviceName, handlers }),
		writeTemplateFile({
			template: 'tsconfig.ejs',
			output: 'client/tsconfig.json',
			data,
		}),
		writeTemplateFile({
			template: 'package.ejs',
			output: 'client/package.json',
			data,
		}),
		writeTemplateFile({
			template: 'base-response.ejs',
			output: 'client/src/types/base-response.ts',
			data,
		}),
		writeTemplateFile({
			template: 'make-request.ejs',
			output: 'client/src/helpers/make-request.ts',
			data,
		}),
		writeTemplateFile({
			template: 'is-response-successful.ejs',
			output: 'client/src/helpers/is-response-successful.ts',
			data,
		}),
		writeTemplateFile({
			template: 'build-response.ejs',
			output: 'client/src/helpers/build-response.ts',
			data,
		}),
		writeTemplateFile({
			template: 'axios-client.ejs',
			output: 'client/src/helpers/axios-client.ts',
			data,
		}),
	]);

	/**
	 * Write request code
	 */
	await Promise.all(
		Object.values(handlers).map(
			async (handler) => await writeRequestCode({ serviceName, handler }),
		),
	);
}

generateClient();
