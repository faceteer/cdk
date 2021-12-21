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

export interface ApiHandlerOptions<B, Q, A> extends ApiHandlerDefinition {
	validators: {
		body?: (requestBody: any) => B;
		query?: (requestQuery: any) => Q;
	};
	isAuthorized?: (event: APIGatewayProxyEventV2) => A;
}

export type ValidatedApiEvent<B, Q, A> = APIGatewayProxyEventV2 & {
	input: {
		body: B;
		query: Q;
	};
	auth: A;
};

export type ApiHandlerWithDefinition = APIGatewayProxyHandlerV2 & {
	type: HandlerTypes.API;
	definition: ApiHandlerDefinition;
};

/**
 * Creates a handler that will be attached to the service api
 * @param options
 * @param handler
 * @returns
 */
export function ApiHandler<B = unknown, Q = unknown, A = unknown>(
	options: ApiHandlerOptions<B, Q, A>,
	handler: Handler<
		ValidatedApiEvent<B, Q, A>,
		APIGatewayProxyStructuredResultV2
	>,
): ApiHandlerWithDefinition {
	const { validators, isAuthorized, ...definition } = options;
	const wrappedHandler: APIGatewayProxyHandlerV2 = async (
		event,
		context,
		callback,
	) => {
		try {
			const validatedEvent: ValidatedApiEvent<B, Q, A> = {
				...event,
				input: {
					body: validators.body
						? validators.body(event.body ? JSON.parse(event.body) : event.body)
						: (undefined as unknown as B),
					query: validators.query
						? validators.query(event.queryStringParameters ?? {})
						: (undefined as unknown as Q),
				},
				auth: isAuthorized ? isAuthorized(event) : (undefined as unknown as A),
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
