import { EventPattern } from 'aws-cdk-lib/aws-events';
import type { EventBridgeEvent, EventBridgeHandler } from 'aws-lambda';
import { AsyncHandler, HandlerDefinition, HandlerTypes } from './handler';

export interface EventHandlerDefinition extends HandlerDefinition {
	/**
	 * Event handler name
	 */
	name: string;

	/**
	 * Uses event bus name that is provided and configured within stack.
	 * If no name is specified, the first bus listed in the CDK configuration is used.
	 */
	eventBusName?: string;

	/**
	 * The event pattern in which to subscribe to.
	 */
	eventPattern: EventPattern;
}

export type EventHandlerEvent<T extends string, D> = EventBridgeEvent<T, D>;

export interface EventHandlerOptions<T extends string, D>
	extends EventHandlerDefinition {
	validator: (
		detail: EventBridgeEvent<string, any>,
	) => EventBridgeEvent<T, D> | void;
}

export type EventHandlerWithDefinition<
	T extends string,
	D,
> = EventBridgeHandler<T, D, void> & {
	type: HandlerTypes.Event;
	definition: EventHandlerDefinition;
};

export function EventHandler<T extends string, D = unknown>(
	options: EventHandlerOptions<T, D>,
	handler: AsyncHandler<EventHandlerEvent<T, D>, void>,
): EventHandlerWithDefinition<T, D> {
	const { validator, ...definition } = options;

	const wrappedHandler: EventBridgeHandler<T, D, void> = async (
		event,
		context,
	) => {
		try {
			const validDetail = validator(event);
			if (!validDetail) {
				throw new Error('Invalid event detail');
			}

			await handler(validDetail, context);
		} catch (error) {
			console.error(error);
			return;
		}
	};

	return Object.assign(wrappedHandler, {
		type: HandlerTypes.Event as const,
		definition: definition,
	});
}
