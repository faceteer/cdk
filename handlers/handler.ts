import type { Context } from 'aws-lambda';
import { LogRetentionDays } from '../util/log-retention';

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
	/**
	 * Should function logs be destroyed if the function itself is removed.
	 *
	 * This is 'destroy' by default, but you may wish to pick 'keep' so logs can
	 * be audited even after the function is deleted.
	 */
	logRetention?: 'destroy' | 'retain';
	/**
	 * How long should logs be kept while the stack is live?
	 */
	logRetentionDuration?: LogRetentionDays;
	/**
	 * The AWS Lambda runtime to use for functions.
	 *
	 * The supported runtimes are listed in the type for convenience. In case
	 * there are new Nodejs runtimes available, you should be able to pick those
	 * here as well. Check the AWS Lambda documentation for the supported nodejs
	 * runtimes: https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html
	 *
	 * Defaults to nodejs20.x if not specified.
	 */
	runtime?: 'nodejs18.x' | 'nodejs20.x' | 'nodejs22.x';
	/**
	 * The AWS Lambda architecture to use for functions.
	 *
	 * Not all code will run out of the box on arm architectures. Code using
	 * native modules may need to be specifically built for arm.
	 */
	architecture?: 'x86_64' | 'arm64';
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
}
