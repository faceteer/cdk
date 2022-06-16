import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventTargets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import type { FullHandlerDefinition } from '../extract/extract-handlers';
import { EventHandlerDefinition } from '../handlers';

export interface ServiceEventFunctionProps {
	role: iam.IRole;
	definition: FullHandlerDefinition<EventHandlerDefinition>;
	bundlingOptions?: lambdaNodeJs.BundlingOptions;
	layers?: lambda.ILayerVersion[];
	eventBus: events.IEventBus;
}

export class ServiceEventFunction extends Construct {
	readonly fn: lambdaNodeJs.NodejsFunction;
	readonly definition: FullHandlerDefinition<EventHandlerDefinition>;

	constructor(
		scope: Construct,
		id: string,
		{
			role,
			definition,
			bundlingOptions,
			layers,
			eventBus,
		}: ServiceEventFunctionProps,
	) {
		super(scope, id);

		const timeout = definition.timeout
			? cdk.Duration.seconds(definition.timeout)
			: cdk.Duration.seconds(60);

		this.definition = definition;

		const sharedFunctionProps: lambdaNodeJs.NodejsFunctionProps = {
			role: role,
			awsSdkConnectionReuse: true,
			entry: definition.path,
			description: definition.description,
			allowAllOutbound: definition.allowAllOutbound,
			allowPublicSubnet: definition.allowPublicSubnet,
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
				ACCOUNT_ID: cdk.Fn.ref('AWS::AccountId'),
				DD_TAGS: `handler_type:queue,handler_name:${definition.name}`,
			},
			layers,
		};

		this.fn = new lambdaNodeJs.NodejsFunction(
			this,
			'Function',
			sharedFunctionProps,
		);

		new events.Rule(this, 'Rule', {
			eventBus,
			eventPattern: definition.eventPattern,
			targets: [new eventTargets.LambdaFunction(this.fn)],
		});
	}
}
