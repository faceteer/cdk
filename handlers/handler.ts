import type { Context } from 'aws-lambda';

/**
 * The base lambda handler definition for all
 * handlers
 */
export interface HandlerDefinition {
	/**
	 * Whether to allow the Lambda to send all network traffic.
	 */
	allowAllOutbound?: boolean;
	/**
	 * Lambda Functions in a public subnet can NOT access the internet.
	 */
	allowPublicSubnet?: boolean;
	/**
	 * The amount of memory available to the function at runtime. Increasing the function's memory also
	 * increases its CPU allocation. The default value is 128 MB. The value can be any multiple of 1 MB.
	 */
	memorySize?: number;
	/**
	 * A description of the function.
	 */
	description?: string;
	/**
	 * The amount of time that Lambda allows a function to run before stopping it.
	 * The default is 3 seconds. The maximum allowed value is 900 seconds.
	 */
	timeout?: number;
	/**
	 * The maximum of concurrent executions you want to reserve for the function.
	 */
	reservedConcurrentExecutions?: number;
	/**
	 * Enable AWS X-Ray Tracing for Lambda Function.
	 */
	tracing?: boolean;
	/**
	 * Attach the lambda function to the VPC
	 */
	vpc?: boolean;
}

/**
 * A handler that must return a promise
 * and doesn't use the callback pattern
 */
export type AsyncHandler<TEvent = any, TResult = any> = (
	event: TEvent,
	context?: Context,
) => Promise<TResult>;

/**
 * The different types of handlers supported
 * by this library
 */
export enum HandlerTypes {
	API = 'api',
	Cron = 'cron',
	Queue = 'queue',
	Event = 'event',
	Notification = 'notification',
	Edge = 'edge',
}
