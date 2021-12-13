import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { constantCase } from 'constant-case';
import { Construct } from 'constructs';
import type { FullHandlerDefinition } from '../extract/extract-handlers';
import { QueueHandlerDefinition } from '../handlers/queue-handler';

export interface ServiceQueueFunctionProps {
	role: iam.IRole;
	definition: FullHandlerDefinition<QueueHandlerDefinition>;
	bundlingOptions?: lambdaNodeJs.BundlingOptions;
}

export class ServiceQueueFunction extends Construct {
	readonly fn: lambdaNodeJs.NodejsFunction;
	readonly queue: sqs.Queue;
	readonly dlq: sqs.Queue;
	readonly queueEnvironmentVariable: string;
	readonly dlqEnvironmentVariable: string;
	readonly definition: FullHandlerDefinition<QueueHandlerDefinition>;

	constructor(
		scope: Construct,
		id: string,
		{ role, definition, bundlingOptions }: ServiceQueueFunctionProps,
	) {
		super(scope, id);

		const timeout = definition.timeout
			? cdk.Duration.seconds(definition.timeout)
			: cdk.Duration.seconds(60);

		const maximumAttempts = definition.maximumAttempts ?? 10;

		this.queueEnvironmentVariable = `QUEUE_${constantCase(
			definition.queueName,
		)}`;
		this.dlqEnvironmentVariable = `DLQ_${constantCase(definition.queueName)}`;

		this.definition = definition;

		this.dlq = new sqs.Queue(this, `Dlq`, {
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

		this.queue.grantSendMessages(role);
		this.queue.grantConsumeMessages(role);

		const sharedFunctionProps: lambdaNodeJs.NodejsFunctionProps = {
			role: role,
			awsSdkConnectionReuse: true,
			entry: definition.path,
			description: definition.description,
			allowAllOutbound: definition.allowAllOutbound,
			allowPublicSubnet: definition.allowPublicSubnet,
			bundling: {
				...bundlingOptions,
				sourceMap: true,
				sourceMapMode: lambdaNodeJs.SourceMapMode.INLINE,
			},
			environment: {
				NODE_OPTIONS: '--enable-source-maps',
				HANDLER_NAME: definition.name,
				ACCOUNT_ID: cdk.Fn.ref('AWS::AccountId'),
			},
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
