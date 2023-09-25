import * as cdk from 'aws-cdk-lib';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { NotificationHandlerDefinition } from '../handlers';
import { BaseFunction, BaseFunctionProps } from './base-function';

export interface ServiceNotificationFunctionProps
	extends BaseFunctionProps<NotificationHandlerDefinition> {
	topics: sns.Topic[];
}

export class ServiceNotificationFunction extends BaseFunction<NotificationHandlerDefinition> {
	readonly dlq: sqs.Queue;
	readonly eventSources: lambdaEventSources.SnsEventSource[] = [];

	constructor(
		scope: Construct,
		id: string,
		props: ServiceNotificationFunctionProps,
	) {
		const { definition, defaults } = props;
		super(scope, id, {
			...props,
			defaults: {
				timeout: 60,
				...defaults,
			},
			environment: {
				DD_TAGS: `handler_type:notification,handler_name:${definition.name}`,
				...props.environment,
			},
		});

		this.dlq = new sqs.Queue(this, 'DLQ', {
			receiveMessageWaitTime: cdk.Duration.seconds(20),
		});

		for (const topic of props.topics) {
			this.eventSources.push(
				new lambdaEventSources.SnsEventSource(topic, {
					filterPolicy: definition.filterPolicy,
					deadLetterQueue: this.dlq,
				}),
			);
		}
	}
}
