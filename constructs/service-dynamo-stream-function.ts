import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import { DynamoStreamHandlerDefinition } from '../handlers/dynamo-stream-handler';
import { BaseFunction, BaseFunctionProps } from './base-function';

export interface ServiceDynamoStreamFunctionProps
	extends BaseFunctionProps<DynamoStreamHandlerDefinition> {
	table: dynamodb.ITable;
}

const startingPositions = {
	TRIM_HORIZON: lambda.StartingPosition.TRIM_HORIZON,
	LATEST: lambda.StartingPosition.LATEST,
};

export class ServiceDynamoStreamFunction extends BaseFunction<DynamoStreamHandlerDefinition> {
	readonly eventSource: lambdaEventSources.DynamoEventSource;

	constructor(
		scope: Construct,
		id: string,
		props: ServiceDynamoStreamFunctionProps,
	) {
		const { definition, defaults, table } = props;
		super(scope, id, {
			...props,
			defaults: {
				timeout: 60,
				...defaults,
			},
			environment: {
				DD_TAGS: `handler_type:dynamo-stream,handler_name:${definition.name}`,
				...props.environment,
			},
		});

		this.eventSource = new lambdaEventSources.DynamoEventSource(table, {
			startingPosition:
				startingPositions[definition.startingPosition ?? 'TRIM_HORIZON'],
			batchSize: definition.batchSize,
			maxBatchingWindow: definition.maxBatchingWindow
				? cdk.Duration.seconds(definition.maxBatchingWindow)
				: undefined,
			retryAttempts: definition.retryAttempts,
			bisectBatchOnError: definition.bisectBatchOnError,
			parallelizationFactor: definition.parallelizationFactor,
			maxRecordAge: definition.maxRecordAge
				? cdk.Duration.seconds(definition.maxRecordAge)
				: undefined,
			reportBatchItemFailures: true,
		});
		// DynamoEventSource grants the function's role stream-read permissions
		// on the table when bound.
		this.addEventSource(this.eventSource);
	}
}
