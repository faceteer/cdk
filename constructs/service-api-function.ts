import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import type { HandlerNameAndPath } from '../extract/extract-handlers';
import type { ApiHandlerDefinition } from '../handlers/api-handler';

export interface ServiceApiFunctionProps {
	role: iam.IRole;
	httpApi: apigwv2.CfnApi;
	definition: ApiHandlerDefinition & HandlerNameAndPath;
	authorizer?: apigwv2.CfnAuthorizer;
	bundlingOptions?: lambdaNodeJs.BundlingOptions;
	layers?: lambda.ILayerVersion[];
	defaultScopes?: string[];
}

export class ServiceApiFunction extends Construct {
	readonly fn: lambdaNodeJs.NodejsFunction;
	readonly route: apigwv2.CfnRoute;

	constructor(
		scope: Construct,
		id: string,
		{
			role,
			httpApi,
			authorizer,
			definition,
			bundlingOptions = {},
			layers,
			defaultScopes = [],
		}: ServiceApiFunctionProps,
	) {
		super(scope, id);

		let authorizerType = 'NONE';
		if (authorizer?.authorizerType === 'JWT') {
			authorizerType = 'JWT';
		} else if (authorizer?.authorizerType === 'REQUEST') {
			authorizerType = 'CUSTOM';
		}

		const apiGatewayServicePrincipal = new iam.ServicePrincipal(
			'apigateway.amazonaws.com',
		);

		this.fn = new lambdaNodeJs.NodejsFunction(this, 'Function', {
			awsSdkConnectionReuse: true,
			entry: definition.path,
			description: definition.description,
			memorySize: definition.memorySize ?? 192,
			reservedConcurrentExecutions: definition.reservedConcurrentExecutions,
			timeout: definition.timeout
				? cdk.Duration.seconds(Math.max(30, definition.timeout))
				: undefined,
			role: role,
			bundling: {
				...bundlingOptions,
				sourceMap: true,
				sourceMapMode: lambdaNodeJs.SourceMapMode.INLINE,
			},
			environment: {
				NODE_OPTIONS: '--enable-source-maps',
				HANDLER_NAME: definition.name,
				DD_TAGS: `handler_type:api,handler_name:${definition.name}`,
			},
			layers,
		});

		this.fn.grantInvoke(apiGatewayServicePrincipal);

		const integration = new apigwv2.CfnIntegration(this, `Integration`, {
			apiId: httpApi.ref,
			description: definition.description,
			integrationType: 'AWS_PROXY',
			integrationUri: cdk.Fn.join('', [
				'arn:',
				cdk.Fn.ref('AWS::Partition'),
				':apigateway:',
				cdk.Fn.ref('AWS::Region'),
				':lambda:path/2015-03-31/functions/',
				this.fn.functionArn,
				'/invocations',
			]),
			integrationMethod: 'POST',
			payloadFormatVersion: '2.0',
		});

		this.route = new apigwv2.CfnRoute(this, `Route`, {
			apiId: httpApi.ref,
			routeKey: `${definition.method} ${definition.route}`,
			target: cdk.Fn.join('/', ['integrations', integration.ref]),
			authorizerId: definition.disableAuth ? undefined : authorizer?.ref,
			authorizationType: definition.disableAuth ? 'NONE' : authorizerType,
			authorizationScopes: definition.scopes ?? defaultScopes,
		});
	}
}
