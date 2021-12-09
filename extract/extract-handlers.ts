import * as fs from 'fs';
import { pascalCase } from 'pascal-case';
import * as path from 'path';
import type {
	ApiHandlerDefinition,
	ApiHandlerWithDefinition,
} from '../handlers/api-handler';
import { HandlerTypes } from '../handlers/handler';
import {
	QueueHandlerDefinition,
	QueueHandlerWithDefinition,
} from '../handlers/queue-handler';

export interface HandlerNameAndPath {
	name: string;
	path: string;
}
export type FullHandlerDefinition<T> = T & HandlerNameAndPath;

export function extractHandlers(path: string) {
	const files = getAllFiles(path);
	const handlers: {
		api: Record<string, FullHandlerDefinition<ApiHandlerDefinition>>;
		queue: Record<string, FullHandlerDefinition<QueueHandlerDefinition>>;
	} = {
		api: {},
		queue: {},
	};

	for (const file of files) {
		try {
			const handler = require(file.replace(/\.ts$/g, '')).handler as
				| ApiHandlerWithDefinition
				| QueueHandlerWithDefinition<unknown>;
			switch (handler.type) {
				case HandlerTypes.API:
					{
						const { definition } = handler;
						const fullDefinition: FullHandlerDefinition<ApiHandlerDefinition> =
							{
								...definition,
								name: `${definition.method}${definition.route.replace(
									/\//g,
									'-',
								)}`,
								path: file,
							};

						handlers.api[fullDefinition.name] = fullDefinition;
					}

					break;
				case HandlerTypes.Queue: {
					const { definition } = handler;
					const fullDefinition: FullHandlerDefinition<QueueHandlerDefinition> =
						{
							...definition,
							name: pascalCase(`Queue ${definition.queueName}`),
							path: file,
						};
					handlers.queue[fullDefinition.name] = fullDefinition;
				}
			}
		} catch (error) {
			console.error(`Failed to parse handler: ${file}`);
		}
	}

	return handlers;
}

/**
 * Get all of the files in a specified folder
 * @param dirPath
 * @param arrayOfFiles
 */
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
	const files = fs.readdirSync(dirPath);

	let filesArray = arrayOfFiles;

	files.forEach((file) => {
		if (fs.statSync(`${dirPath}/${file}`).isDirectory()) {
			filesArray = getAllFiles(`${dirPath}/${file}`, arrayOfFiles);
		} else if (file.includes('.handler.')) {
			filesArray.push(path.join(dirPath, '/', file));
		}
	});

	return filesArray;
}
