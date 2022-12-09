import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import type { FullHandlerDefinition } from '../extract/extract-handlers';
import { LambdaServiceProps } from './lambda-service';
import { ISecurityGroup, IVpc, SubnetSelection } from 'aws-cdk-lib/aws-ec2';
import { HandlerDefinition } from '../handlers/handler';

export interface BaseFunctionProps<T extends HandlerDefinition> {
	role: iam.IRole;
	definition: FullHandlerDefinition<T>;
	bundlingOptions?: lambdaNodeJs.BundlingOptions;
	layers?: lambda.ILayerVersion[];
	defaults?: LambdaServiceProps['defaults'];
	network?: {
		vpc: IVpc;
		vpcSubnets?: SubnetSelection;
		securityGroups?: ISecurityGroup[];
	};
	environment?: { [key: string]: string };
}

export class BaseFunction<
	T extends HandlerDefinition,
> extends lambdaNodeJs.NodejsFunction {
	readonly definition: FullHandlerDefinition<T>;
	readonly timeout: cdk.Duration;

	constructor(
		scope: Construct,
		id: string,
		{
			role,
			definition,
			bundlingOptions = {},
			layers,
			defaults,
			network,
			environment,
		}: BaseFunctionProps<T>,
	) {
		const useVpc = definition.vpc ?? defaults?.vpc ?? false;
		if (useVpc && network === undefined) {
			throw new Error(
				'Function is defined to use VPC, but no VPC has been provided for service.',
			);
		}
		const timeout = cdk.Duration.seconds(
			definition.timeout ?? defaults?.timeout ?? 30,
		);

		super(scope, id, {
			awsSdkConnectionReuse: true,
			entry: definition.path,
			description: definition.description,
			memorySize: definition.memorySize ?? defaults?.memorySize ?? 192,
			reservedConcurrentExecutions: definition.reservedConcurrentExecutions,
			allowAllOutbound: definition.allowAllOutbound,
			allowPublicSubnet: definition.allowPublicSubnet,
			timeout,
			role,
			bundling: {
				sourceMap: true,
				sourceMapMode: lambdaNodeJs.SourceMapMode.INLINE,
				...bundlingOptions,
			},
			environment: {
				NODE_OPTIONS: '--enable-source-maps',
				HANDLER_NAME: definition.name,
				ACCOUNT_ID: cdk.Fn.ref('AWS::AccountId'),
				...environment,
			},
			layers,
			vpc: useVpc ? network?.vpc : undefined,
			vpcSubnets: useVpc ? network?.vpcSubnets : undefined,
			securityGroups: useVpc ? network?.securityGroups : undefined,
		});

		this.definition = definition;
		this.timeout = timeout;

		const logRetention =
			definition.logRetention ?? defaults?.logRetention ?? 'destroy';
		new logs.LogGroup(this, 'LogGroup', {
			logGroupName: `/aws/lambda/${this.functionName}`,
			removalPolicy:
				logRetention === 'destroy'
					? cdk.RemovalPolicy.DESTROY
					: cdk.RemovalPolicy.RETAIN,
		});
	}
}
