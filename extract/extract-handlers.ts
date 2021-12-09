import * as fs from 'fs';
import * as path from 'path';
import type { ApiHandlerDefinition } from '../handlers/api-handler';
import { HandlerTypes } from '../handlers/handler-types';

export interface HandlerNameAndPath {
	name: string;
	path: string;
}
export type FullHandlerDefinition<T> = T & HandlerNameAndPath;

export function extractHandlers(path: string) {
	const files = getAllFiles(path);
	const handlers: {
		api: Record<string, FullHandlerDefinition<ApiHandlerDefinition>>;
	} = {
		api: {},
	};

	for (const file of files) {
		try {
			const { type, definition } = require(file.replace(/\.ts$/g, '')).handler;
			switch (type) {
				case HandlerTypes.API:
					{
						definition.name = `${definition.method}${definition.route.replace(
							/\//g,
							'-',
						)}`;
						definition.path = file;
						handlers.api[definition.name] = definition;
					}

					break;
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
