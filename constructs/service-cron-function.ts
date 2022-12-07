import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { CronHandlerDefinition } from '../handlers';
import { BaseFunction, BaseFunctionProps } from './base-function';

export type ServiceCronFunctionProps = BaseFunctionProps<CronHandlerDefinition>;

export class ServiceCronFunction extends BaseFunction<CronHandlerDefinition> {
	readonly rule: events.Rule;

	constructor(scope: Construct, id: string, props: ServiceCronFunctionProps) {
		const { definition } = props;
		super(scope, id, {
			...props,
			environment: {
				DD_TAGS: `handler_type:cron,handler_name:${definition.name}`,
				...props.environment,
			},
		});

		/**
		 * Add the scheduled event for this cron job.
		 */
		this.rule = new events.Rule(this, `${definition.name}Rule`, {
			schedule: events.Schedule.expression(
				definition.schedule.expressionString,
			),
			targets: [new eventsTargets.LambdaFunction(this)],
		});
	}
}
