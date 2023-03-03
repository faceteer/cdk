import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as events from 'aws-cdk-lib/aws-events';
import { constantCase } from 'change-case';
import { Construct } from 'constructs';
import { extractHandlers } from '../extract/extract-handlers';
import { ServiceApiFunction } from './service-api-function';
import { ServiceNotificationFunction } from './service-notification-function';
import { ServiceQueueFunction } from './service-queue-function';
import { ServiceCronFunction } from './service-cron-function';
import { ServiceEventFunction } from './service-event-function';
import { validatePathParameters } from '../util/validate-path-parameters';
import {
	ApiGateway,
	ApiStage,
	isJwtAuthorizerConfig,
	isLambdaAuthorizerConfig,
	JwtAuthorizer,
	JwtAuthorizerConfig,
	LambdaAuthorizer,
	LambdaAuthorizerConfig,
} from './api-gateway';
import { CfnAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2';
import { ISecurityGroup, IVpc, SubnetSelection } from 'aws-cdk-lib/aws-ec2';
import { BaseFunctionProps } from './base-function';
import { LogRetentionDays } from '../util/log-retention';
import { HandlerDefinition } from '../handlers';

export interface LambdaServiceProps {
	/** The path to the folder where the handlers are stored.
	 *
	 * If omitted, then the service will have no handlers. This can be useful if
	 * you want to create a dummy service that will contain all the resources you
	 * may need like an api gateway, which you can then pass into other actual
	 * services.
	 */
	handlersFolder?: string;
	/** The API gateway that the API handlers in this service should be attached
	 * to.
	 *
	 * If this is not provided and the service includes API handlers, a new API
	 * gateway will be created.
	 */
	api?: apigwv2.CfnApi;
	/** The API gateway stage that the API handlers in this service should be
	 * attached to.
	 *
	 * If this is not provided and the service includes API handlers, a new API
	 * gateway stage will be created.
	 */
	stage?: apigwv2.CfnStage;
	/** The Authorizer to use for the API handlers.
	 *
	 * This can either be an actual authorizer, in which case we'll use it. Or it
	 * can be a configuration for either a Jwt or Lambda authorizer, in which case
	 * we'll create a new authorizer with that configuration.
	 */
	authorizer?: JwtAuthorizerConfig | LambdaAuthorizerConfig | CfnAuthorizer;
	/** @deprecated Please use the same value on {@link authorizer} instead. */
	jwtAuthorizer?: {
		identitySource: string[];
		audience: string[];
		issuer: string;
	};
	/** @deprecated Please use the same value on {@link authorizer} instead. */
	lambdaAuthorizer?: {
		fn: lambda.IFunction;
		identitySource: string[];
		enableSimpleResponses?: boolean;
	};
	/** The default options that will apply to all handlers.
	 *
	 * These options apply to all handlers.
	 * They can be overridden in the handler configuration itself.
	 */
	defaults?: {
		scopes?: string[];
		memorySize?: number;
		timeout?: number;
		vpc?: boolean;
		logRetention?: 'destroy' | 'retain';
		logRetentionDuration?: LogRetentionDays;
		runtime?: HandlerDefinition['runtime'];
		architecture?: HandlerDefinition['architecture'];
	};
	/** VPC, subnet, and security groups for the lambda functions.
	 *
	 * If provided, all functions will be created in the VPC by default. You can
	 * override that by setting `vpc: false`, either globally in {@link defaults}
	 * or per-function in the function handler definition.
	 */
	network?: {
		/** The VPC that the Lambda handlers should run in. */
		vpc: IVpc;
		/** The VPC subnets that the Lambda handlers should run in.
		 *
		 * If undefined, the Vpc default strategy is used.
		 */
		vpcSubnets?: SubnetSelection;
		/** The security groups that apply to the Lambda handlers.
		 *
		 * If undefined,
		 */
		securityGroups?: ISecurityGroup[];
	};
	/** @deprecated Use `defaults.scopes` */
	defaultScopes?: string[];
	bundlingOptions?: lambdaNodeJs.BundlingOptions;
	role?: iam.IRole;
	layers?: lambda.ILayerVersion[];
	domain?: {
		certificate: acm.ICertificate;
		domainName: string;
		route53Zone?: route53.IHostedZone;
	};
	/**
	 * Use the key to reference the appropriate event bus in your Event Handler definition.
	 */
	eventBuses?: { [key: string]: events.IEventBus };
}

export class LambdaService extends Construct implements iam.IGrantable {
	readonly api: apigwv2.CfnApi;
	readonly stage: apigwv2.CfnStage;
	readonly grantPrincipal: iam.IPrincipal;
	readonly authorizer?: apigwv2.CfnAuthorizer;

	/** Maps queue names to the queue handlers of this service, if any. */
	public queues: Map<string, ServiceQueueFunction> = new Map();

	public functions: lambda.Function[] = [];
	private environmentVariables: Map<string, string> = new Map();
	private snsTopics: Map<string, sns.Topic> = new Map();

	constructor(
		scope: Construct,
		id: string,
		{
			handlersFolder,
			authorizer,
			jwtAuthorizer,
			lambdaAuthorizer,
			bundlingOptions = {},
			role,
			defaults,
			defaultScopes,
			domain,
			eventBuses,
			api,
			stage,
			layers,
			network,
		}: LambdaServiceProps,
	) {
		super(scope, id);

		this.environmentVariables.set('NODE_OPTIONS', '--enable-source-maps');
		this.environmentVariables.set('ACCOUNT_ID', cdk.Fn.ref('AWS::AccountId'));

		if (network && defaults?.vpc === undefined) {
			// If a VPC is supplied, then enable VPC use for functions by default. It
			// could be an easy mistake to add a VPC but not enable its usage.
			defaults = {
				...defaults,
				vpc: true,
			};
		}

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
		 * The HTTP api.
		 *
		 * We create a new API gateway and stage if one was not provided. If one is
		 * provided, for example if this is being used as a module in a larger
		 * stack, then we'll use the provided gateway and stage.
		 */
		this.api =
			api ?? new ApiGateway(this, 'Api', { name: cdk.Names.uniqueId(this) });
		this.stage = stage ?? new ApiStage(this, 'Stage', { api: this.api });

		if (authorizer === undefined) {
			// Keep backward compatibility
			authorizer = lambdaAuthorizer ?? jwtAuthorizer;
		}
		/**
		 * If an existing authorizer is provided, we'll use that. If not, we'll
		 * create a new one with the given config.
		 */
		if (authorizer instanceof CfnAuthorizer) {
			this.authorizer = authorizer;
		} else if (isLambdaAuthorizerConfig(authorizer)) {
			this.authorizer = new LambdaAuthorizer(this, 'Authorizer', {
				api: this.api,
				config: authorizer,
				name: `${cdk.Names.uniqueId(this)}LambdaAuthorizer`,
			});
		} else if (isJwtAuthorizerConfig(authorizer)) {
			this.authorizer = new JwtAuthorizer(this, 'Authorizer', {
				api: this.api,
				config: authorizer,
				name: `${cdk.Names.uniqueId(this)}JwtAuthorizer`,
			});
		}

		/**
		 * Get all handler information from handlers
		 */
		const handlers: ReturnType<typeof extractHandlers> = handlersFolder
			? extractHandlers(handlersFolder)
			: { api: {}, notification: {}, queue: {}, cron: {}, event: {} };

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

		/** Function props shared by all functions. Just add definition and any handler-specific props! */
		const baseFunctionProps: Omit<BaseFunctionProps<never>, 'definition'> = {
			role,
			bundlingOptions,
			layers,
			defaults,
			network,
		};

		/**
		 * Create all of the API handlers
		 */
		for (const apiHandler of Object.values(handlers.api)) {
			/**
			 * Validate that `pathParameters` and `route` are consistent
			 */
			validatePathParameters(apiHandler.route, [
				...(apiHandler.pathParameters ?? []),
			]);
			/**
			 * Add a new function to the API
			 */
			const apiFn = new ServiceApiFunction(this, apiHandler.name, {
				...baseFunctionProps,
				defaultScopes,
				definition: apiHandler,
				httpApi: this.api,
				authorizer: this.authorizer,
			});
			this.functions.push(apiFn);
		}

		for (const queueHandler of Object.values(handlers.queue)) {
			/**
			 * Create the queue handlers and their respective queues
			 */
			const queueFn = new ServiceQueueFunction(this, queueHandler.name, {
				...baseFunctionProps,
				definition: queueHandler,
			});
			this.functions.push(queueFn);
			this.queues.set(queueFn.definition.queueName, queueFn);

			this.environmentVariables.set(
				queueFn.queueEnvironmentVariable,
				queueFn.queue.queueName,
			);

			this.environmentVariables.set(
				queueFn.dlqEnvironmentVariable,
				queueFn.dlq.queueName,
			);
		}

		for (const eventHandler of Object.values(handlers.event)) {
			if (!eventBuses) {
				throw new Error(
					'Tried to create an event handler without any configured event buses',
				);
			}

			let eventBus: events.IEventBus;
			if (eventBuses[eventHandler.eventBusName]) {
				// Treated `eventBusName` as a key to reference configured event buses
				eventBus = eventBuses[eventHandler.eventBusName];
			} else {
				// Treated `eventBusName` as the aws event bus name
				const matchedEventBus = Object.values(eventBuses).find(
					(bus) => bus.eventBusName === eventHandler.eventBusName,
				);
				if (!matchedEventBus) {
					throw new Error(`
						Could not find the event bus "${eventHandler.eventBusName}" specified event bus name. 
						Please make sure the event handler "${eventHandler.name}" is configured properly or that you have configured the appropriate event buses.
					`);
				}
				eventBus = matchedEventBus;
			}

			const eventFn = new ServiceEventFunction(this, eventHandler.name, {
				...baseFunctionProps,
				definition: eventHandler,
				eventBus,
			});
			this.functions.push(eventFn);
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
					...baseFunctionProps,
					definition: notificationHandler,
					topic,
				},
			);

			this.functions.push(notificationFn);
		}

		for (const cronHandler of Object.values(handlers.cron)) {
			/**
			 * Create cron handlers
			 */
			const cronFn = new ServiceCronFunction(this, cronHandler.name, {
				...baseFunctionProps,
				definition: cronHandler,
			});

			this.functions.push(cronFn);
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

	/** Allows this service to send messages to the queue handled by this
	 * function.
	 *
	 * This is only necessary if you are sending messages across services.
	 * The service always has access to its own queues.
	 */
	public grantSendToQueue(queueFn: ServiceQueueFunction) {
		this.addEnvironment(
			queueFn.queueEnvironmentVariable,
			queueFn.queue.queueName,
		);
		this.addEnvironment(queueFn.dlqEnvironmentVariable, queueFn.dlq.queueName);
		queueFn.queue.grantSendMessages(this);
		queueFn.dlq.grantSendMessages(this);
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
