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

export type EventHandlerEvent<T> = EventBridgeEvent<string, T>;

export interface EventHandlerOptions<T> extends EventHandlerDefinition {
	validator: (
		detail: EventBridgeEvent<string, T>,
	) => EventBridgeEvent<string, T>;
}

export type EventHandlerWithDefinition<T> = EventBridgeHandler<
	string,
	T,
	void
> & {
	type: HandlerTypes.Event;
	definition: EventHandlerDefinition;
};

export function EventHandler<T = unknown>(
	options: EventHandlerOptions<T>,
	handler: AsyncHandler<EventHandlerEvent<T>, void>,
): EventHandlerWithDefinition<T> {
	const { validator, ...definition } = options;

	const wrappedHandler: EventBridgeHandler<string, T, void> = async (
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
