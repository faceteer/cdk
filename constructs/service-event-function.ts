import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventTargets from 'aws-cdk-lib/aws-events-targets';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
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
	readonly queue: sqs.Queue;
	readonly dlq: sqs.Queue;
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

		const maximumAttempts = definition.maximumAttempts ?? 10;

		this.definition = definition;

		this.dlq = new sqs.Queue(this, 'Dlq', {
			retentionPeriod: cdk.Duration.days(14),
			receiveMessageWaitTime: cdk.Duration.seconds(20),
			visibilityTimeout: timeout,
		});

		this.dlq.grantSendMessages(role);
		this.dlq.grantConsumeMessages(role);

		this.queue = new sqs.Queue(this, 'Queue', {
			retentionPeriod: cdk.Duration.days(14),
			receiveMessageWaitTime: cdk.Duration.seconds(20),
			visibilityTimeout: timeout,
			deadLetterQueue: {
				maxReceiveCount: maximumAttempts,
				queue: this.dlq,
			},
		});

		const rule = new events.Rule(this, 'Rule', {
			eventBus,
			eventPattern: definition.eventPattern,
		});
		rule.addTarget(new eventTargets.SqsQueue(this.queue));

		this.queue.grantSendMessages(role);
		this.queue.grantConsumeMessages(role);

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

		this.fn.addEventSource(
			new lambdaEventSources.SqsEventSource(this.queue, {
				batchSize: definition.batchSize,
				maxBatchingWindow: definition.maxBatchingWindow
					? cdk.Duration.seconds(definition.maxBatchingWindow)
					: undefined,
				reportBatchItemFailures: true,
			}),
		);
	}
}
