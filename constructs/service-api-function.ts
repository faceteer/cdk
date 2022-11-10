import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import type { ApiHandlerDefinition } from '../handlers/api-handler';
import { LambdaServiceProps } from './lambda-service';
import { BaseFunction, BaseFunctionProps } from './base-function';
import { routeToAlphaNumeric } from '../util/route-to-alphanumeric';

export interface ServiceApiFunctionProps
	extends BaseFunctionProps<ApiHandlerDefinition> {
	httpApi: apigwv2.CfnApi;
	authorizer?: apigwv2.CfnAuthorizer;
	defaultScopes?: LambdaServiceProps['defaultScopes'];
}

export class ServiceApiFunction extends BaseFunction<ApiHandlerDefinition> {
	readonly route: apigwv2.CfnRoute;
	readonly integration: apigwv2.CfnIntegration;

	constructor(scope: Construct, id: string, props: ServiceApiFunctionProps) {
		const {
			httpApi,
			authorizer,
			definition,
			defaultScopes = [],
			defaults,
		} = props;
		super(scope, id, {
			...props,
			defaults: {
				timeout: 30,
				...defaults,
			},
			environment: {
				DD_TAGS: `handler_type:api,handler_name:${definition.name}`,
				...props.environment,
			},
		});

		let authorizerType = 'NONE';
		if (authorizer?.authorizerType === 'JWT') {
			authorizerType = 'JWT';
		} else if (authorizer?.authorizerType === 'REQUEST') {
			authorizerType = 'CUSTOM';
		}

		const apiGatewayServicePrincipal = new iam.ServicePrincipal(
			'apigateway.amazonaws.com',
		);
		this.grantInvoke(apiGatewayServicePrincipal);

		this.integration = new apigwv2.CfnIntegration(this, `Integration`, {
			apiId: httpApi.ref,
			description: definition.description,
			integrationType: 'AWS_PROXY',
			integrationUri: cdk.Fn.join('', [
				'arn:',
				cdk.Fn.ref('AWS::Partition'),
				':apigateway:',
				cdk.Fn.ref('AWS::Region'),
				':lambda:path/2015-03-31/functions/',
				this.functionArn,
				'/invocations',
			]),
			integrationMethod: 'POST',
			payloadFormatVersion: '2.0',
		});

		this.integration.overrideLogicalId(
			definition.cfnOverrides?.logicalIds?.integration ??
				`ServiceApiIntegration${definition.method}${routeToAlphaNumeric(
					definition.route,
				)}`,
		);

		if (definition.cfnOverrides?.logicalIds?.function) {
			(this.node.defaultChild as lambda.CfnFunction).overrideLogicalId(
				definition.cfnOverrides?.logicalIds?.function,
			);
		}
		this.route = new apigwv2.CfnRoute(this, `Route`, {
			apiId: httpApi.ref,
			routeKey: `${definition.method} ${definition.route}`,
			target: cdk.Fn.join('/', ['integrations', this.integration.ref]),
			authorizerId: definition.disableAuth ? undefined : authorizer?.ref,
			authorizationType: definition.disableAuth ? 'NONE' : authorizerType,
			authorizationScopes:
				definition.disableAuth || authorizerType !== 'JWT'
					? undefined
					: definition.scopes ?? defaults?.scopes ?? defaultScopes,
		});
		this.route.overrideLogicalId(
			definition.cfnOverrides?.logicalIds?.route ??
				`ServiceApiRoute${definition.method}${routeToAlphaNumeric(
					definition.route,
				)}`,
		);
	}
}
