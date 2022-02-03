import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import type {
	APIGatewayProxyEventPathParameters,
	APIGatewayProxyEventV2,
	APIGatewayProxyHandlerV2,
	Handler,
} from 'aws-lambda';
import * as qs from 'qs';
import { FailedResponse, IFailedResponse, ISuccessResponse } from '../response';
import { HandlerDefinition, HandlerTypes } from './handler';

const ajv = new Ajv({
	removeAdditional: 'all',
	coerceTypes: true,
});

export type ApiPathParameters<T extends ReadonlyArray<string>> = Record<
	T[number],
	string
>;

export interface ApiHandlerDefinition<B = never, Q = never, R = never>
	extends HandlerDefinition {
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
	 * Optional scopes to add for a route
	 */
	scopes?: string[];

	schemas: {
		body?: JSONSchemaType<B>;
		query?: JSONSchemaType<Q>;
		response?: JSONSchemaType<R>;
	};
}

export type ApiHandlerAuthorizer<A> = (
	event: APIGatewayProxyEventV2,
) => A | false;

export interface ApiHandlerOptions<B, Q, A, P extends ReadonlyArray<string>, R>
	extends ApiHandlerDefinition<B, Q, R> {
	authorizer?: ApiHandlerAuthorizer<A>;
	pathParameters?: P;
}

export type ValidatedApiEvent<
	B,
	Q,
	A,
	P extends ReadonlyArray<string>,
> = APIGatewayProxyEventV2 & {
	input: {
		body: B;
		query: Q;
		path: ApiPathParameters<P>;
		auth: A;
	};
};

export type ApiHandlerFunction<
	B,
	Q,
	A,
	R,
	P extends ReadonlyArray<string>,
> = Handler<
	ValidatedApiEvent<B, Q, A, P>,
	ISuccessResponse<R> | IFailedResponse
>;

export type ApiHandlerWithDefinition<
	B = never,
	Q = never,
	R = never,
> = APIGatewayProxyHandlerV2 & {
	type: HandlerTypes.API;
	definition: ApiHandlerDefinition<B, Q, R>;
};

interface AjvValidators<B, Q> {
	body?: ValidateFunction<B>;
	query?: ValidateFunction<Q>;
}

/**
 * Creates a handler that will be attached to the service api
 * @param options
 * @param handler
 * @returns
 */
export function ApiHandler<
	B = unknown,
	Q = unknown,
	A = unknown,
	P extends ReadonlyArray<string> = never,
	R = unknown,
>(
	options: ApiHandlerOptions<B, Q, A, P, R>,
	handler: ApiHandlerFunction<B, Q, A, R, P>,
): ApiHandlerWithDefinition<B, Q, R> {
	const { schemas, authorizer, pathParameters, ...definition } = options;

	const ajvValidators: AjvValidators<B, Q> = {};

	if (schemas.body) {
		ajvValidators.body = ajv.compile(schemas.body);
	}

	if (schemas.query) {
		ajvValidators.query = ajv.compile(schemas.query);
	}

	const wrappedHandler: APIGatewayProxyHandlerV2 = async (event, context) => {
		try {
			let auth = undefined as unknown as A;
			if (authorizer) {
				try {
					const authResult = authorizer(event);
					if (authResult) {
						auth = authResult;
					} else {
						return FailedResponse('Unauthorized', { statusCode: 403 });
					}
				} catch {
					return FailedResponse('Unauthorized', { statusCode: 403 });
				}
			}

			const validatedParameters = checkPathParameters<P>(
				event.pathParameters,
				pathParameters,
			);

			if (typeof validatedParameters === 'string') {
				return FailedResponse(
					`The parameter "${validatedParameters}" was not found in the route "${options.route}". Please check your route configuration`,
				);
			}

			let queryBody: unknown;
			if (event.rawQueryString) {
				try {
					queryBody = qs.parse(event.rawQueryString);
				} catch (error) {
					return FailedResponse(error);
				}
			}

			const validatedBody = validateInput(ajvValidators.body, event.body ?? {});
			const validatedQuery = validateInput(
				ajvValidators.query,
				queryBody ?? {},
			);

			const validatedEvent: ValidatedApiEvent<B, Q, A, P> = {
				...event,
				input: {
					body: validatedBody,
					query: validatedQuery,
					path: validatedParameters,
					auth: auth,
				},
			};

			const result = handler(validatedEvent, context, () => {});
			if (result) {
				const finalResult = await result;
				if ('bodyString' in finalResult) {
					return {
						body: finalResult.bodyString,
						cookies: finalResult.cookies,
						headers: finalResult.headers,
						isBase64Encoded: finalResult.isBase64Encoded,
						statusCode: finalResult.statusCode,
					};
				}
				return finalResult;
			}
			throw new Error('The API handler return an invalid response type');
		} catch (error) {
			return FailedResponse(error);
		}
	};

	return Object.assign(wrappedHandler, {
		definition: {
			...definition,
			schemas,
		},
		type: HandlerTypes.API as const,
	});
}

/**
 * Validate the input for our query or our body depending
 * @param validator
 * @param input
 * @returns
 */
function validateInput<T>(
	validator?: ValidateFunction<T>,
	input?: string | unknown,
): T {
	if (!validator) {
		return input as unknown as T;
	}
	/**
	 * Assume any string inputs are JSON
	 */
	if (typeof input === 'string') {
		input = JSON.parse(input);
	}

	if (validator(input)) {
		return input;
	}
	const [validationError] = validator.errors ?? [];
	throw (
		validationError ??
		new Error('Unknown error running AJV validator for input')
	);
}

/**
 * Check to make sure that path parameters that have
 * been defined exist on the function
 * @param pathParameters
 * @param definedParameters
 * @returns
 */
function checkPathParameters<P extends ReadonlyArray<string>>(
	pathParameters: APIGatewayProxyEventPathParameters = {},
	definedParameters?: P,
): ApiPathParameters<P> | string {
	if (!definedParameters) {
		return {} as ApiPathParameters<P>;
	}
	const validatedParameters: Record<string, string> = {};
	for (const param of definedParameters) {
		const value = pathParameters[param];
		if (!value) {
			return param;
		}
		validatedParameters[param] = value;
	}

	return validatedParameters as ApiPathParameters<P>;
}
