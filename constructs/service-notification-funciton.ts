import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import type { FullHandlerDefinition } from '../extract/extract-handlers';
import { NotificationHandlerDefinition } from '../handlers';

export interface ServiceNotificationFunctionProps {
	role: iam.IRole;
	definition: FullHandlerDefinition<NotificationHandlerDefinition>;
	bundlingOptions?: lambdaNodeJs.BundlingOptions;
	topic: sns.Topic;
	layers?: lambda.ILayerVersion[];
}

export class ServiceNotificationFunction extends Construct {
	readonly fn: lambdaNodeJs.NodejsFunction;
	readonly dlq: sqs.Queue;
	readonly definition: FullHandlerDefinition<NotificationHandlerDefinition>;

	constructor(
		scope: Construct,
		id: string,
		{
			role,
			definition,
			bundlingOptions,
			topic,
			layers,
		}: ServiceNotificationFunctionProps,
	) {
		super(scope, id);

		const timeout = definition.timeout
			? cdk.Duration.seconds(definition.timeout)
			: cdk.Duration.seconds(60);

		this.definition = definition;

		this.fn = new lambdaNodeJs.NodejsFunction(this, 'Function', {
			role: role,
			awsSdkConnectionReuse: true,
			entry: definition.path,
			description: definition.description,
			allowAllOutbound: definition.allowAllOutbound,
			allowPublicSubnet: definition.allowPublicSubnet,
			timeout,
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
			layers,
		});

		this.dlq = new sqs.Queue(this, 'DLQ', {
			receiveMessageWaitTime: cdk.Duration.seconds(20),
		});

		this.fn.addEventSource(
			new lambdaEventSources.SnsEventSource(topic, {
				filterPolicy: definition.filterPolicy,
				deadLetterQueue: this.dlq,
			}),
		);
	}
}
