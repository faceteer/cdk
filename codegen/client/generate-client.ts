import { camelCase, pascalCase } from 'change-case';
import ejs from 'ejs';
import path from 'path';
import { extractHandlers, FullHandlerDefinition } from '../../extract';
import { ApiHandlerDefinition } from '../../handlers';
import fs from 'fs';
import { printNode, zodToTs } from 'zod-to-ts';
import { z } from 'zod';
import glob from 'glob';

const writeServiceClass = async ({
	serviceName,
	handlers,
	filesToRemove,
}: {
	serviceName: string;
	handlers: FullHandlerDefinition<ApiHandlerDefinition<never, never, never>>[];
	filesToRemove: string[];
}) => {
	if (!filesToRemove.includes(`client/src/${serviceName}.ts`)) return;
	const code = await ejs.renderFile('codegen/client/templates/class.ejs', {
		serviceName,
		functionNames: handlers.map(({ name }) => camelCase(name)),
	});

	fs.writeFileSync(`client/src/${serviceName}.ts`, code);
};

const writeRequestCode = async ({
	serviceName,
	handler,
	filesToRemove,
}: {
	serviceName: string;
	handler: FullHandlerDefinition<ApiHandlerDefinition<never, never, never>>;
	filesToRemove: string[];
}) => {
	const output = `client/src/requests/${camelCase(handler.name)}.ts`;
	if (!filesToRemove.includes(output)) return;

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

	const queryKeys = Object.keys(handler?.schemas?.query?.shape ?? {});
	const bodyKeys = Object.keys(handler?.schemas?.body?.shape ?? {});

	let dataObject = '';
	for (const key of bodyKeys) {
		dataObject += `\n		${key}: request.${key},`;
	}
	if (bodyKeys.length === 0) dataObject = '{}';
	else dataObject = `{${dataObject}\n	}`;

	let paramsObject = '';
	for (const key of queryKeys) {
		paramsObject += `\n		${key}: request?.${key},`;
	}
	if (queryKeys.length === 0) paramsObject = '{}';
	else paramsObject = `{${paramsObject}\n	}`;

	const requestName = pascalCase(`${handler.name}Request`);
	const requestType = printNode(zodToTs(requestSchema).node).replace(
		/ {4}/g,
		'	',
	);

	let code = await ejs.renderFile('codegen/client/templates/request.ejs', {
		serviceName,
		functionName: camelCase(handler.name),
		requestName,
		requestType,
		responseName: pascalCase(`${handler.name}Response`),
		responseType: printNode(zodToTs(responseSchema).node).replace(/ {4}/g, '	'),
		route: handler.route.replace(/{/g, '${request.'),
		method: handler.method,
		dataObject,
		paramsObject,
	});

	if (requestType === '{}') {
		code = code.replace(`\n	request: ${requestName},`, '');
	}

	fs.writeFileSync(output, code);
};

const writeTemplateFile = async ({
	data,
	template,
	output,
}: {
	data: { serviceName: string; packageName: string; filesToRemove: string[] };
	template: string;
	output: string;
}) => {
	if (!data.filesToRemove.includes(output)) return;
	const code = await ejs.renderFile(
		`codegen/client/templates/${template}`,
		data,
	);
	fs.writeFileSync(output, code);
};

const ConfigSchema = z.object({ exclude: z.array(z.string()).optional() });

async function generateClient() {
	const { api } = extractHandlers(path.join(__dirname, '../../fixtures/'));
	const handlers = Object.values(api);

	handlers.forEach((handler) => {
		handler.name = handler.name.replace('Api', '');
	});
	const serviceName = pascalCase('Test');

	const doesConfigExist = fs.existsSync('client/faceteer.json');
	const excludedFiles = ['client/faceteer.json'];
	if (doesConfigExist) {
		const rawConfig = fs.readFileSync('client/faceteer.json');
		const config = ConfigSchema.parse(JSON.parse(rawConfig.toString()));
		for (const file of config.exclude ?? []) {
			excludedFiles.push(`client/${file}`);
		}
	}
	const filesToRemove = glob.sync('client/**/*', {
		ignore: excludedFiles,
		nodir: true,
	});
	filesToRemove.map(fs.unlinkSync);
	console.log(filesToRemove);

	/**
	 * Prep client directory
	 */
	if (!fs.existsSync('client')) fs.mkdirSync('client');
	if (!fs.existsSync('client/src')) fs.mkdirSync('client/src');
	if (!fs.existsSync('client/src/requests'))
		fs.mkdirSync('client/src/requests');
	if (!fs.existsSync('client/src/helpers')) fs.mkdirSync('client/src/helpers');
	if (!fs.existsSync('client/src/types')) fs.mkdirSync('client/src/types');

	/**
	 * Write necessary helper files
	 */
	const data = {
		serviceName,
		packageName: '@tailwind/test',
		baseURL: 'https://test.tailwindapp.net',
		filesToRemove,
	};
	writeServiceClass({ serviceName, handlers, filesToRemove });
	writeTemplateFile({
		template: 'tsconfig.ejs',
		output: 'client/tsconfig.json',
		data,
	});
	writeTemplateFile({
		template: 'package.ejs',
		output: 'client/package.json',
		data,
	});
	writeTemplateFile({
		template: 'base-response.ejs',
		output: 'client/src/types/base-response.ts',
		data,
	});
	writeTemplateFile({
		template: 'make-request.ejs',
		output: 'client/src/helpers/make-request.ts',
		data,
	});
	writeTemplateFile({
		template: 'is-response-successful.ejs',
		output: 'client/src/helpers/is-response-successful.ts',
		data,
	});
	writeTemplateFile({
		template: 'build-response.ejs',
		output: 'client/src/helpers/build-response.ts',
		data,
	});
	writeTemplateFile({
		template: 'axios-client.ejs',
		output: 'client/src/helpers/axios-client.ts',
		data,
	});

	/**
	 * Write request code
	 */
	await Promise.all(
		Object.values(handlers).map(
			async (handler) =>
				await writeRequestCode({ serviceName, handler, filesToRemove }),
		),
	);
}

generateClient();
