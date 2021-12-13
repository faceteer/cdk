import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyHandlerV2,
	APIGatewayProxyStructuredResultV2,
	Handler,
} from 'aws-lambda';
import { FailedResponse } from '../response/failed-response';
import { HandlerDefinition, HandlerTypes } from './handler';

export interface ApiHandlerDefinition extends HandlerDefinition {
	/** HTTP method for which this function is invoked. */
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	/**
	 * Uri path for which this function is invoked. Must start with `/.`
	 */
	route: string;
	/**
	 * Whether or not to disable authentication
	 * for a route
	 */
	disableAuth?: boolean;
	/**
	 * Optional overrides of the scopes for a route
	 */
	scopes?: string[];
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

/**
 * Creates a handler that will be attached to the service api
 * @param options
 * @param handler
 * @returns
 */
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
					body: bodyValidator(event.body ? JSON.parse(event.body) : event.body),
					query: queryValidator(event.queryStringParameters ?? {}),
				},
			};

			const result = handler(validatedEvent, context, callback);
			if (result) {
				return await result;
			}
			throw new Error('The API handler return an invalid response type');
		} catch (error) {
			return FailedResponse(error);
		}
	};

	return Object.assign(wrappedHandler, {
		definition,
		type: HandlerTypes.API as const,
	});
}
