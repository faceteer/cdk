import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import { constantCase } from 'change-case';
import { Construct } from 'constructs';
import { extractHandlers } from '../extract/extract-handlers';
import { ServiceApiFunction } from './service-api-function';
import { ServiceNotificationFunction } from './service-notification-function';
import { ServiceQueueFunction } from './service-queue-function';
import { ServiceEdgeFunction } from './service-edge-function';

export interface LambdaServiceProps {
	handlersFolder: string;
	jwtAuthorizer?: {
		identitySource: string[];
		audience: string[];
		issuer: string;
	};
	lambdaAuthorizer?: {
		fn: lambda.IFunction;
		identitySource: string[];
		enableSimpleResponses?: boolean;
	};
	defaultScopes?: string[];
	bundlingOptions?: lambdaNodeJs.BundlingOptions;
	role?: iam.IRole;
	layers?: lambda.ILayerVersion[];
	domain?: {
		certificate: acm.ICertificate;
		domainName: string;
		route53Zone?: route53.IHostedZone;
	};
}

export class LambdaService extends Construct implements iam.IGrantable {
	readonly api: apigwv2.CfnApi;
	readonly stage: apigwv2.CfnStage;
	readonly grantPrincipal: iam.IPrincipal;

	public functions: lambda.Function[] = [];
	private environmentVariables: Map<string, string> = new Map();
	private snsTopics: Map<string, sns.Topic> = new Map();

	constructor(
		scope: Construct,
		id: string,
		{
			handlersFolder,
			lambdaAuthorizer,
			jwtAuthorizer,
			bundlingOptions = {},
			role,
			defaultScopes,
			domain,
		}: LambdaServiceProps,
	) {
		super(scope, id);

		this.environmentVariables.set('NODE_OPTIONS', '--enable-source-maps');
		this.environmentVariables.set('ACCOUNT_ID', cdk.Fn.ref('AWS::AccountId'));

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
			name: cdk.Names.uniqueId(this),
		});

		this.stage = new apigwv2.CfnStage(this, 'Stage', {
			apiId: this.api.ref,
			stageName: '$default',
			autoDeploy: true,
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
				authorizerPayloadFormatVersion: '2.0',
				enableSimpleResponses: lambdaAuthorizer.enableSimpleResponses,
			});
		} else if (jwtAuthorizer) {
			authorizer = new apigwv2.CfnAuthorizer(this, 'JwtAuthorizer', {
				apiId: this.api.ref,
				authorizerType: 'JWT',
				name: `${cdk.Names.uniqueId(this)}JwtAuthorizer`,
				identitySource: [...jwtAuthorizer.identitySource],
				jwtConfiguration: {
					audience: [...jwtAuthorizer.audience],
					issuer: jwtAuthorizer.issuer,
				},
			});
		}

		if (domain) {
			const { certificate, domainName, route53Zone } = domain;
			const apiGatewayDomain = new apigwv2.CfnDomainName(this, 'ApiDomain', {
				domainName: domainName,
				domainNameConfigurations: [
					{
						certificateArn: certificate.certificateArn,
						endpointType: 'REGIONAL',
					},
				],
			});
			new apigwv2.CfnApiMapping(this, 'ApiMapping', {
				apiId: this.api.ref,
				domainName: apiGatewayDomain.ref,
				stage: this.stage.ref,
			});

			if (route53Zone) {
				const target = new route53Targets.ApiGatewayv2DomainProperties(
					apiGatewayDomain.attrRegionalDomainName,
					apiGatewayDomain.attrRegionalHostedZoneId,
				);
				new route53.ARecord(this, 'ApiARecord', {
					zone: route53Zone,
					target: route53.RecordTarget.fromAlias(target),
					recordName: domainName,
				});
			}
		}

		/**
		 * Create all of the API handlers
		 */
		for (const apiHandler of Object.values(handlers.api)) {
			/**
			 * Add a new function to the API
			 */
			const apiFn = new ServiceApiFunction(this, apiHandler.name, {
				definition: apiHandler,
				httpApi: this.api,
				role,
				authorizer: authorizer,
				bundlingOptions,
				defaultScopes: defaultScopes,
			});
			this.functions.push(apiFn.fn);
		}

		for (const queueHandler of Object.values(handlers.queue)) {
			/**
			 * Create the queue handlers and their respective queues
			 */
			const queueFn = new ServiceQueueFunction(this, queueHandler.name, {
				role: role,
				definition: queueHandler,
				bundlingOptions,
			});
			this.functions.push(queueFn.fn);

			this.environmentVariables.set(
				queueFn.queueEnvironmentVariable,
				queueFn.queue.queueName,
			);

			this.environmentVariables.set(
				queueFn.dlqEnvironmentVariable,
				queueFn.dlq.queueName,
			);
		}

		for (const notificationHandler of Object.values(handlers.notification)) {
			/**
			 * Create any notification handlers along with any topics that
			 * haven't been created yet
			 */
			let topic = this.snsTopics.get(notificationHandler.topicName);
			if (!topic) {
				topic = new sns.Topic(this, notificationHandler.topicName);
				this.snsTopics.set(notificationHandler.topicName, topic);
				this.environmentVariables.set(
					`TOPIC_${constantCase(notificationHandler.topicName)}`,
					topic.topicName,
				);
				topic.grantPublish(role);
			}
			const notificationFn = new ServiceNotificationFunction(
				this,
				notificationHandler.name,
				{
					definition: notificationHandler,
					role: role,
					topic: topic,
					bundlingOptions,
				},
			);

			this.functions.push(notificationFn.fn);
		}

		/**
		 * Create all of the API handlers
		 */
		for (const edgeHandler of Object.values(handlers.edge)) {
			/**
			 * Add a new function to the API
			 */
			new ServiceEdgeFunction(this, edgeHandler.name, {
				definition: edgeHandler,
				role,
				environmentalVariables: this.environmentVariables,
			});
		}

		/**
		 * Add all environment variables
		 */
		for (const fn of this.functions) {
			for (const [key, value] of this.environmentVariables.entries()) {
				fn.addEnvironment(key, value);
			}
		}
	}

	/**
	 * Add an environment variable to the service
	 * @param key
	 * @param value
	 */
	public addEnvironment(key: string, value: string) {
		this.environmentVariables.set(key, value);

		for (const fn of this.functions) {
			fn.addEnvironment(key, value);
		}
	}

	/**
	 * Retrieves an SNS topic by it's name
	 * @param topicName
	 */
	public getSnsTopic(topicName: string) {
		const topic = this.snsTopics.get(topicName);
		if (!topic) {
			throw new Error(
				`Unable to find a topic with the name: ${topicName}. Make sure that topic has been configured in a lambda handler already`,
			);
		}
		return topic;
	}
}
