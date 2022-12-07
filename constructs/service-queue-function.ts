import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { constantCase } from 'constant-case';
import { Construct } from 'constructs';
import { QueueHandlerDefinition } from '../handlers/queue-handler';
import { BaseFunction, BaseFunctionProps } from './base-function';

export type ServiceQueueFunctionProps =
	BaseFunctionProps<QueueHandlerDefinition>;

export class ServiceQueueFunction extends BaseFunction<QueueHandlerDefinition> {
	readonly queue: sqs.Queue;
	readonly dlq: sqs.Queue;
	readonly queueEnvironmentVariable: string;
	readonly dlqEnvironmentVariable: string;
	readonly eventSource: lambdaEventSources.SqsEventSource;

	constructor(scope: Construct, id: string, props: ServiceQueueFunctionProps) {
		const { role, definition } = props;
		super(scope, id, {
			...props,
			environment: {
				DD_TAGS: `handler_type:queue,handler_name:${definition.name}`,
				...props.environment,
			},
		});

		const maximumAttempts = definition.maximumAttempts ?? 10;

		this.queueEnvironmentVariable = `QUEUE_${constantCase(
			definition.queueName,
		)}`;
		this.dlqEnvironmentVariable = `DLQ_${constantCase(definition.queueName)}`;

		this.dlq = new sqs.Queue(this, `Dlq`, {
			retentionPeriod: cdk.Duration.days(14),
			receiveMessageWaitTime: cdk.Duration.seconds(20),
			visibilityTimeout: this.timeout,
		});

		this.dlq.grantSendMessages(role);
		this.dlq.grantConsumeMessages(role);

		this.queue = new sqs.Queue(this, 'Queue', {
			retentionPeriod: cdk.Duration.days(14),
			receiveMessageWaitTime: cdk.Duration.seconds(20),
			visibilityTimeout: this.timeout,
			deadLetterQueue: {
				maxReceiveCount: maximumAttempts,
				queue: this.dlq,
			},
		});

		this.queue.grantSendMessages(role);
		this.queue.grantConsumeMessages(role);

		this.eventSource = new lambdaEventSources.SqsEventSource(this.queue, {
			batchSize: definition.batchSize,
			maxBatchingWindow: definition.maxBatchingWindow
				? cdk.Duration.seconds(definition.maxBatchingWindow)
				: undefined,
			reportBatchItemFailures: true,
		});
		this.addEventSource(this.eventSource);
	}
}
