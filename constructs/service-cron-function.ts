import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import type { FullHandlerDefinition } from '../extract/extract-handlers';
import { CronHandlerDefinition } from '../handlers';

export interface ServiceCronFunctionProps {
	role: iam.IRole;
	definition: FullHandlerDefinition<CronHandlerDefinition>;
	bundlingOptions?: lambdaNodeJs.BundlingOptions;
	layers?: lambda.ILayerVersion[];
}

export class ServiceCronFunction extends Construct {
	readonly fn: lambdaNodeJs.NodejsFunction;

	constructor(
		scope: Construct,
		id: string,
		{
			role,
			definition,
			bundlingOptions = {},
			layers,
		}: ServiceCronFunctionProps,
	) {
		super(scope, id);

		const timeout = definition.timeout
			? cdk.Duration.seconds(definition.timeout)
			: cdk.Duration.seconds(60);

		/**
		 * Create the lambda function
		 */
		this.fn = new lambdaNodeJs.NodejsFunction(this, 'Function', {
			role: role,
			awsSdkConnectionReuse: true,
			entry: definition.path,
			description: definition.description,
			allowAllOutbound: definition.allowAllOutbound,
			memorySize: definition.memorySize ?? 256,
			timeout: timeout,
			bundling: {
				...bundlingOptions,
				sourceMap: true,
				sourceMapMode: lambdaNodeJs.SourceMapMode.INLINE,
			},
			environment: {
				NODE_OPTIONS: '--enable-source-maps',
				HANDLER_NAME: definition.name,
				DD_TAGS: `handler_type:cron,handler_name:${definition.name}`,
			},
			layers,
		});

		/**
		 * Add the scheduled event for this cron job.
		 */
		const rule = new events.Rule(this, `${definition.name}Rule`, {
			schedule: events.Schedule.expression(
				definition.schedule.expressionString,
			),
		});
		rule.addTarget(new eventsTargets.LambdaFunction(this.fn));
	}
}
