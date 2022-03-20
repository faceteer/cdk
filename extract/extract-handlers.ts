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
			const handler = require(file.replace(/\.ts$/g, '')).handler as
				| ApiHandlerWithDefinition
				| QueueHandlerWithDefinition<unknown>
				| EventHandlerWithDefinition<EventBridgeEvent<string, unknown>>
				| CronHandlerWithDefinition
				| NotificationHandlerWithDefinition;
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
				case HandlerTypes.Queue:
					{
						const { definition } = handler;
						const fullDefinition: FullHandlerDefinition<QueueHandlerDefinition> =
							{
								...definition,
								name: pascalCase(`Queue ${definition.queueName}`),
								path: file,
							};
						handlers.queue[fullDefinition.name] = fullDefinition;
					}
					break;
				case HandlerTypes.Event:
					{
						const { definition } = handler;
						const fullDefinition: FullHandlerDefinition<EventHandlerDefinition> =
							{
								...definition,
								name: pascalCase(`Event ${definition.name}`),
								path: file,
							};
						handlers.event[fullDefinition.name] = fullDefinition;
					}
					break;
				case HandlerTypes.Cron:
					{
						const { definition } = handler;
						const fullDefinition: FullHandlerDefinition<CronHandlerDefinition> =
							{
								...definition,
								path: file,
								name: pascalCase(definition.name),
							};
						handlers.cron[fullDefinition.name] = fullDefinition;
					}
					break;
				case HandlerTypes.Notification:
					{
						const { definition } = handler;
						const fullDefinition: FullHandlerDefinition<NotificationHandlerDefinition> =
							{
								...definition,
								path: file,
								name: pascalCase(`${definition.topicName}-${definition.name}`),
							};

						handlers.notification[fullDefinition.name] = fullDefinition;
					}
					break;
			}
		} catch (error) {
			console.error(`Failed to parse handler: ${file}`);
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
