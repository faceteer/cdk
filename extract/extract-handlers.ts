import { EventBridgeEvent } from 'aws-lambda';
import * as fs from 'fs';
import { pascalCase } from 'pascal-case';
import * as path from 'path';
import {
	CronHandlerDefinition,
	CronHandlerWithDefinition,
	EventHandlerDefinition,
	EventHandlerWithDefinition,
	NotificationHandlerDefinition,
	NotificationHandlerWithDefinition,
} from '../handlers';
import type {
	ApiHandlerDefinition,
	ApiHandlerWithDefinition,
} from '../handlers/api-handler';
import { HandlerTypes } from '../handlers/handler';
import {
	QueueHandlerDefinition,
	QueueHandlerWithDefinition,
} from '../handlers/queue-handler';
import * as crypto from 'crypto';

export interface HandlerNameAndPath {
	name: string;
	path: string;
}
export type FullHandlerDefinition<T> = T & HandlerNameAndPath;

type AnyHandler =
	| ApiHandlerWithDefinition
	| QueueHandlerWithDefinition<unknown>
	| EventHandlerWithDefinition<EventBridgeEvent<string, unknown>>
	| CronHandlerWithDefinition
	| NotificationHandlerWithDefinition;

function handlerName(handler: AnyHandler) {
	switch (handler.type) {
		case HandlerTypes.API:
			return pascalCase(`Api ${handler.definition.name}`);
		case HandlerTypes.Queue:
			return pascalCase(`Queue ${handler.definition.queueName}`);
		case HandlerTypes.Event:
			return pascalCase(`Event ${handler.definition.name}`);
		case HandlerTypes.Cron:
			return pascalCase(handler.definition.name);
		case HandlerTypes.Notification:
			return pascalCase(
				`${handler.definition.topicName}-${handler.definition.name}`,
			);
	}
}

function makeHandlerDefinition<T extends AnyHandler>({
	handler,
	file,
	name,
}: {
	handler: T;
	file: string;
	name: string;
}) {
	const { definition } = handler;
	return {
		...definition,
		name,
		path: file,
	};
}

export function extractHandlers(path: string) {
	const files = getAllFiles(path);
	// Sort the files to get consistent duplicate name handling
	files.sort();

	const handlers: {
		api: Record<string, FullHandlerDefinition<ApiHandlerDefinition>>;
		queue: Record<string, FullHandlerDefinition<QueueHandlerDefinition>>;
		event: Record<string, FullHandlerDefinition<EventHandlerDefinition>>;
		notification: Record<
			string,
			FullHandlerDefinition<NotificationHandlerDefinition>
		>;
		cron: Record<string, FullHandlerDefinition<CronHandlerDefinition>>;
	} = {
		api: {},
		queue: {},
		event: {},
		notification: {},
		cron: {},
	};

	for (const file of files) {
		try {
			const handler = require(file.replace(/\.ts$/g, '')).handler as AnyHandler;

			let name = handlerName(handler);
			// In case of a collision, we'll add a portion of the file hash to the handler name.
			const pathHash = crypto
				.createHash('sha256')
				.update(file)
				.digest('hex')
				.slice(0, 6);
			if (handlers[handler.type][name] !== undefined) {
				name = `${name}${pathHash}`;
				if (handlers[handler.type][name] !== undefined) {
					// If they are still colliding with hash, we'll give up
					throw new Error(
						`There are multiple function with the name ${handler.name}, please rename one of them.`,
					);
				}
			}

			const fullDefinition = makeHandlerDefinition({ handler, file, name });
			handlers[handler.type][fullDefinition.name] = fullDefinition;
		} catch (error) {
			console.error(`Failed to parse handler: ${file}`);
			console.error(error);
			throw error;
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
		} else if (file.includes('.handler.') && !file.includes('.test.')) {
			filesArray.push(path.join(dirPath, '/', file));
		}
	});

	return filesArray;
}
