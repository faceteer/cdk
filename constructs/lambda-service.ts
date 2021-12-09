import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { extractHandlers } from '../extract/extract-handlers';
import { ServiceApiFunction } from './service-api-function';

export interface LambdaServiceProps {
	handlersFolder: string;
	lambdaAuthorizer?: {
		fn: lambda.IFunction;
		identitySource: string[];
	};
	bundlingOptions?: lambdaNodeJs.BundlingOptions;
	role?: iam.IRole;
}

export class LambdaService extends Construct implements iam.IGrantable {
	readonly api: apigwv2.CfnApi;
	readonly grantPrincipal: iam.IPrincipal;

	private functions: lambda.Function[] = [];

	constructor(
		scope: Construct,
		id: string,
		{
			handlersFolder,
			lambdaAuthorizer,
			bundlingOptions = {},
			role,
		}: LambdaServiceProps,
	) {
		super(scope, id);

		if (!role) {
			/**
			 * Role that the API lambda functions will assume
			 */
			role = new iam.Role(this, 'LambdaRole', {
				assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
				description: `Role for ${cdk.Names.uniqueId(this)}`,
				managedPolicies: [
					iam.ManagedPolicy.fromAwsManagedPolicyName(
						'service-role/AWSLambdaBasicExecutionRole',
					),
					iam.ManagedPolicy.fromAwsManagedPolicyName(
						'service-role/AWSLambdaVPCAccessExecutionRole',
					),
				],
			});
		}

		this.grantPrincipal = role.grantPrincipal;

		/**
		 * The HTTP api
		 */
		this.api = new apigwv2.CfnApi(this, 'Api', {
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
				allowMethods: ['GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
				allowOrigins: ['*'],
				maxAge: 864000,
			},
			name: cdk.Names.uniqueId(this),
		});

		/**
		 * Get all handler information from handlers
		 */
		const handlers = extractHandlers(handlersFolder);

		let authorizer: apigwv2.CfnAuthorizer | undefined = undefined;
		if (lambdaAuthorizer) {
			authorizer = new apigwv2.CfnAuthorizer(this, 'Authorizer', {
				apiId: this.api.ref,
				authorizerType: 'REQUEST',
				authorizerUri: cdk.Fn.join('', [
					'arn:',
					cdk.Fn.ref('AWS::Partition'),
					':apigateway:',
					cdk.Fn.ref('AWS::Region'),
					':lambda:path/2015-03-31/functions/',
					lambdaAuthorizer.fn.functionArn,
					'/invocations',
				]),
				name: `${cdk.Names.uniqueId(this)}LambdaAuthorizer`,
				identitySource: [...lambdaAuthorizer.identitySource],
			});
		}

		/**
		 * Create all of the API handlers
		 */
		for (const apiHandler of Object.values(handlers.api)) {
			/**
			 * Get a name for the API handler based on it's path and route
			 */
			const apiHandlerName = `${apiHandler.method}${apiHandler.route.replace(
				/\//g,
				'-',
			)}`;
			/**
			 * Add a new function to the API
			 */
			const apiFn = new ServiceApiFunction(this, apiHandlerName, {
				definition: apiHandler,
				httpApi: this.api,
				role,
				authorizerId: authorizer?.ref,
				bundlingOptions,
			});
			this.functions.push(apiFn.fn);
		}
	}
}
