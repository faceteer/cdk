import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import type { FullHandlerDefinition } from '../extract/extract-handlers';
import { EdgeHandlerDefinition } from '../handlers';

export interface ServiceEdgeFunctionProps {
	role: iam.IRole;
	definition: FullHandlerDefinition<EdgeHandlerDefinition>;
	environmentVariables: Map<string, string>;
	layers?: lambda.ILayerVersion[];
}

export class ServiceEdgeFunction extends Construct {
	readonly fn: cloudfront.experimental.EdgeFunction;
	readonly definition: FullHandlerDefinition<EdgeHandlerDefinition>;

	constructor(
		scope: Construct,
		id: string,
		{
			role,
			definition,
			environmentVariables,
			layers,
		}: ServiceEdgeFunctionProps,
	) {
		super(scope, id);

		const timeout = definition.timeout
			? cdk.Duration.seconds(definition.timeout)
			: cdk.Duration.seconds(60);

		this.definition = definition;

		const env: Record<string, string> = {};
		for (const [key, value] of environmentVariables.entries()) {
			env[key] = value;
		}

		this.fn = new cloudfront.experimental.EdgeFunction(this, 'Function', {
			role,
			description: definition.description,
			allowAllOutbound: definition.allowAllOutbound,
			allowPublicSubnet: definition.allowPublicSubnet,
			memorySize: definition.memorySize ?? 256,
			timeout,
			runtime: lambda.Runtime.NODEJS_12_X,
			code: lambda.Code.fromAsset(definition.path),
			handler: 'index.handler',
			environment: {
				...env,
				NODE_OPTIONS: '--enable-source-maps',
				HANDLER_NAME: definition.name,
				DD_TAGS: `handler_type:edge,handler_name:${definition.name}`,
			},
			layers,
		});

		const distribution = cloudfront.Distribution.fromDistributionAttributes(
			this,
			'ImportedDist',
			{
				distributionId: definition.distributionId,
				domainName: definition.distributionDomain,
			},
		);

		// TODO: Add edge function to distribution
	}
}
