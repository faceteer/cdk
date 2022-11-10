import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sns from 'aws-cdk-lib/aws-sns';
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
import { CfnApi, CfnAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2';

export interface ModularLambdaServiceProps {
	handlersFolder: string;
	defaults?: {
		scopes: string[];
		memorySize: number;
		timeout: number;
	};
	bundlingOptions?: lambdaNodeJs.BundlingOptions;
	role?: iam.IRole;
	layers?: lambda.ILayerVersion[];
	api: CfnApi;
	authorizer: CfnAuthorizer;
	/**
	 * Use the key to reference the appropriate event bus in your Event Handler definition.
	 */
	eventBuses?: { [key: string]: events.IEventBus };
}

export class ModularLambdaService extends Construct implements iam.IGrantable {
	readonly api: apigwv2.CfnApi;
	readonly grantPrincipal: iam.IPrincipal;

	public functions: lambda.Function[] = [];
	private environmentVariables: Map<string, string> = new Map();
	private snsTopics: Map<string, sns.Topic> = new Map();

	constructor(
		scope: Construct,
		id: string,
		{
			handlersFolder,
			bundlingOptions = {},
			role,
			defaults,
			eventBuses,
			api,
			authorizer,
		}: ModularLambdaServiceProps,
	) {
		super(scope, id);

		this.environmentVariables.set('NODE_OPTIONS', '--enable-source-maps');
		this.environmentVariables.set('ACCOUNT_ID', cdk.Fn.ref('AWS::AccountId'));
		this.api = api;
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
		 * Get all handler information from handlers
		 */
		const handlers = extractHandlers(handlersFolder);

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
				definition: apiHandler,
				httpApi: this.api,
				role,
				authorizer,
				bundlingOptions,
				defaultScopes: defaults?.scopes,
				defaults,
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
				role: role,
				definition: eventHandler,
				bundlingOptions,
				eventBus,
			});
			this.functions.push(eventFn.fn);
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

		for (const cronHandler of Object.values(handlers.cron)) {
			/**
			 * Create cron handlers
			 */
			const cronFn = new ServiceCronFunction(this, cronHandler.name, {
				definition: cronHandler,
				role: role,
				bundlingOptions,
			});

			this.functions.push(cronFn.fn);
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
