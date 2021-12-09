import { Schedule } from 'aws-cdk-lib/aws-events';
import { HandlerDefinition, HandlerTypes } from './handler';
import type { ScheduledHandler } from 'aws-lambda';

export interface CronHandlerDefinition extends HandlerDefinition {
	schedule: Schedule;
}

export type CronHandlerWithDefinition = ScheduledHandler & {
	type: HandlerTypes.Cron;
	definition: CronHandlerDefinition;
};

/**
 * Creates a handler that will run on a schedule
 * @param options
 * @param handler
 * @returns
 */
export function CronHandler(
	options: CronHandlerDefinition,
	handler: ScheduledHandler,
): CronHandlerWithDefinition {
	return Object.assign(handler, {
		definition: options,
		type: HandlerTypes.Cron as const,
	});
}
