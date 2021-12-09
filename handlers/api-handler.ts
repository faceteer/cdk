import type {
	APIGatewayProxyHandlerV2,
	APIGatewayProxyEventV2,
	Handler,
	APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { FailedResponse } from '../response/failed-response';
import { HandlerTypes } from './handler-types';

export interface ApiHandlerDefinition {
	/** HTTP method for which this function is invoked. */
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	/** Uri path for which this function is invoked. Must start with /. */
	route: string;
	/**
	 * The amount of memory available to the function at runtime. Increasing the function's memory also
	 * increases its CPU allocation. The default value is 128 MB. The value can be any multiple of 1 MB.
	 */
	memorySize?: number;
	/** A description of the function. */
	description?: string;
	/**
	 * The amount of time that Lambda allows a function to run before stopping it.
	 * The default is 3 seconds. The maximum allowed value is 900 seconds.
	 */
	timeout?: number;
	/**
	 * Whether or not to disable authentication
	 * for a route
	 */
	disableAuth?: boolean;
	/**
	 * Optional overrides of the scopes for a route
	 */
	scopes?: string[];
	/**
	 * The maximum of concurrent executions you want to reserve for the function.
	 */
	reservedConcurrentExecutions?: number;
}

export interface ApiHandlerOptions<B, Q> extends ApiHandlerDefinition {
	validators: {
		body?: (requestBody: any) => B;
		query?: (requestQuery: any) => Q;
	};
}

export type ValidatedApiEvent<B, Q> = APIGatewayProxyEventV2 & {
	input: {
		body: B;
		query: Q;
	};
};

export type ApiHandlerWithDefinition = APIGatewayProxyHandlerV2 & {
	type: HandlerTypes.API;
	definition: ApiHandlerDefinition;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function defaultValidator<T>(): T {
	return undefined as unknown as T;
}

export function ApiHandler<B = undefined, Q = undefined>(
	options: ApiHandlerOptions<B, Q>,
	handler: Handler<ValidatedApiEvent<B, Q>, APIGatewayProxyStructuredResultV2>,
): ApiHandlerWithDefinition {
	const { validators, ...definition } = options;
	const wrappedHandler: APIGatewayProxyHandlerV2 = async (
		event,
		context,
		callback,
	) => {
		try {
			const bodyValidator = validators.body ?? defaultValidator;
			const queryValidator = validators.query ?? defaultValidator;

			const validatedEvent: ValidatedApiEvent<B, Q> = {
				...event,
				input: {
					body: bodyValidator(event.body),
					query: queryValidator(event.queryStringParameters),
				},
			};

			const result = handler(validatedEvent, context, callback);
			if (result) {
				return await result;
			}
			throw new Error('Promise was not returned');
		} catch (error) {
			return FailedResponse(error);
		}
	};

	return Object.assign(wrappedHandler, {
		definition,
		type: HandlerTypes.API as const,
	});
}
