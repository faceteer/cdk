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

export interface EventHandlerOptions<T extends string, D extends any>
	extends EventHandlerDefinition {
	/** @deprecated use `validators` instead */
	validator?: (
		detail: EventBridgeEvent<string, any>,
	) => EventBridgeEvent<T, D> | void;
	validators?: {
		type: (type: string) => T | void;
		detail: (detail: unknown) => D | void;
	};
}

export type EventHandlerWithDefinition<
	T extends EventBridgeEvent<string, any>,
> = EventBridgeHandler<T['detail-type'], T['detail'], void> & {
	type: HandlerTypes.Event;
	definition: EventHandlerDefinition;
};

export function EventHandler<T extends string, D extends unknown>(
	options: EventHandlerOptions<T, D>,
	handler: AsyncHandler<EventHandlerEvent<EventBridgeEvent<T, D>>, void>,
): EventHandlerWithDefinition<EventBridgeEvent<T, D>> {
	const { validator, validators, ...definition } = options;

	const wrappedHandler: EventBridgeHandler<T, D, void> = async (
		event,
		context,
	) => {
		try {
			if (validators) {
				const validDetail = validators.detail(event.detail);
				if (!validDetail) {
					throw new Error('Invalid event detail');
				}
				const validType = validators.type(event['detail-type']);
				if (!validType) {
					throw new Error('Invalid event detail type');
				}

				const validEvent: EventBridgeEvent<T, D> = {
					...event,
					'detail-type': validType,
					detail: validDetail,
				};

				await handler(validEvent, context);
			} else if (validator) {
				const validDetail = validator(event);
				if (!validDetail) {
					throw new Error('Invalid event detail');
				}

				await handler(validDetail, context);
			} else {
				await handler(event, context);
			}
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
