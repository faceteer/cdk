import * as events from 'aws-cdk-lib/aws-events';
import * as eventTargets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { EventHandlerDefinition } from '../handlers';
import { BaseFunction, BaseFunctionProps } from './base-function';

export type ServiceEventFunctionProps =
	BaseFunctionProps<EventHandlerDefinition> & {
		eventBus: events.IEventBus;
	};

export class ServiceEventFunction extends BaseFunction<EventHandlerDefinition> {
	readonly rule: events.Rule;

	constructor(scope: Construct, id: string, props: ServiceEventFunctionProps) {
		const { definition, defaults, eventBus } = props;
		super(scope, id, {
			...props,
			defaults: {
				timeout: 60,
				...defaults,
			},
			environment: {
				DD_TAGS: `handler_type:queue,handler_name:${definition.name}`,
				...props.environment,
			},
		});

		this.rule = new events.Rule(this, 'Rule', {
			eventBus,
			eventPattern: definition.eventPattern,
			targets: [new eventTargets.LambdaFunction(this)],
		});
	}
}
