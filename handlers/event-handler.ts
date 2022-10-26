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
	 */
	eventBusName: string;

	/**
	 * The event pattern in which to subscribe to.
	 */
	eventPattern: EventPattern;
}

export type EventHandlerEvent<T extends EventBridgeEvent<string, any>> = T;

export interface EventHandlerOptions<T extends EventBridgeEvent<string, any>>
	extends EventHandlerDefinition {
	validator: (detail: EventBridgeEvent<string, any>) => T | void;
}

export type EventHandlerWithDefinition<
	T extends EventBridgeEvent<string, any>,
> = EventBridgeHandler<T['detail-type'], T['detail'], void> & {
	type: HandlerTypes.Event;
	definition: EventHandlerDefinition;
};

export function EventHandler<T extends EventBridgeEvent<string, any>>(
	options: EventHandlerOptions<T>,
	handler: AsyncHandler<EventHandlerEvent<T>, void>,
): EventHandlerWithDefinition<T> {
	const { validator, ...definition } = options;

	const wrappedHandler: EventBridgeHandler<
		T['detail-type'],
		T['detail'],
		void
	> = async (event, context) => {
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
