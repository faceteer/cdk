import * as fs from 'fs';
import * as path from 'path';
import type { ApiHandlerDefinition } from '../handlers/api-handler';
import { HandlerTypes } from '../handlers/handler-types';

export function extractHandlers(path: string) {
	const files = getAllFiles(path);
	const handlers: {
		api: Record<string, ApiHandlerDefinition>;
	} = {
		api: {},
	};

	for (const file of files) {
		try {
			const handler = require(file.replace(/\.ts$/g, '')).handler;
			switch (handler.type) {
				case HandlerTypes.API:
					handlers.api[file] = handler.definition;
					break;

				default:
					break;
			}
		} catch (error) {
			console.error(error);
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

	let filesArray = arrayOfFiles || [];

	files.forEach((file) => {
		if (fs.statSync(`${dirPath}/${file}`).isDirectory()) {
			filesArray = getAllFiles(`${dirPath}/${file}`, arrayOfFiles);
		} else if (file.includes('.handler.')) {
			filesArray.push(path.join(dirPath, '/', file));
		}
	});

	return filesArray;
}
