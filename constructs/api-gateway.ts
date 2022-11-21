import {
	CfnApi,
	CfnApiProps,
	CfnAuthorizer,
	CfnAuthorizerProps,
	CfnStage,
	CfnStageProps,
} from 'aws-cdk-lib/aws-apigatewayv2';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class ApiGateway extends CfnApi {
	constructor(scope: Construct, id: string, props: CfnApiProps) {
		super(scope, id, {
			protocolType: 'HTTP',
			corsConfiguration: {
				allowHeaders: [
					'Authorization',
					'Content-Type',
					'Accept',
					'Accept-Language',
					'Content-Language',
					'Cf-Access-Jwt-Assertion',
				],
				allowMethods: [
					'GET',
					'HEAD',
					'OPTIONS',
					'PATCH',
					'POST',
					'PUT',
					'DELETE',
				],
				allowOrigins: ['*'],
				maxAge: 3600,
			},
			...props,
		});
	}
}

export class ApiStage extends CfnStage {
	constructor(
		scope: Construct,
		id: string,
		props: Omit<CfnStageProps, 'apiId' | 'stageName'> & { api: CfnApi },
	) {
		super(scope, id, {
			apiId: props.api.ref,
			stageName: '$default',
			autoDeploy: true,
			...props,
		});
	}
}

export type LambdaAuthorizerConfig = {
	// If you are editing this type, make sure to update {@link isLambdaAuthorizerConfig} below as well.
	fn: lambda.IFunction;
	identitySource: string[];
	enableSimpleResponses?: boolean;
};

export type JwtAuthorizerConfig = {
	identitySource: string[];
	audience: string[];
	issuer: string;
};

export function isLambdaAuthorizerConfig(
	config: LambdaAuthorizerConfig | JwtAuthorizerConfig | undefined,
): config is LambdaAuthorizerConfig {
	return (
		!!config &&
		'fn' in config &&
		'identitySource' in config &&
		'enableSimpleResponses' in config
	);
}

export function isJwtAuthorizerConfig(
	config: LambdaAuthorizerConfig | JwtAuthorizerConfig | undefined,
): config is JwtAuthorizerConfig {
	return !!config && !isLambdaAuthorizerConfig(config);
}

export class LambdaAuthorizer extends CfnAuthorizer {
	constructor(
		scope: Construct,
		id: string,
		props: Omit<CfnAuthorizerProps, 'apiId' | 'authorizerType'> & {
			api: CfnApi;
			config: LambdaAuthorizerConfig;
		},
	) {
		super(scope, id, {
			apiId: props.api.ref,
			authorizerType: 'REQUEST',
			authorizerUri: cdk.Fn.join('', [
				'arn:',
				cdk.Fn.ref('AWS::Partition'),
				':apigateway:',
				cdk.Fn.ref('AWS::Region'),
				':lambda:path/2015-03-31/functions/',
				props.config.fn.functionArn,
				'/invocations',
			]),
			identitySource: [...props.config.identitySource],
			authorizerPayloadFormatVersion: '2.0',
			enableSimpleResponses: props.config.enableSimpleResponses,
			...props,
		});
	}
}

export class JwtAuthorizer extends CfnAuthorizer {
	constructor(
		scope: Construct,
		id: string,
		props: Omit<CfnAuthorizerProps, 'apiId' | 'authorizerType'> & {
			api: CfnApi;
			config: JwtAuthorizerConfig;
		},
	) {
		super(scope, id, {
			apiId: props.api.ref,
			authorizerType: 'JWT',
			identitySource: [...props.config.identitySource],
			jwtConfiguration: {
				audience: [...props.config.audience],
				issuer: props.config.issuer,
			},
			...props,
		});
	}
}
