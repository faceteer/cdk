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

export interface ApiHandlerDefinition<
	B = never,
	Q = never,
	R = never,
	P extends ReadonlyArray<string> = ReadonlyArray<string>,
> extends HandlerDefinition {
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
	/**
	 * Parameters within the route. If specified, the route must
	 * contain `{parameter-name}`, ex: /users/{userId}
	 */
	pathParameters?: P;
	/**
	 * Optional override of default AJV instance
	 *
	 * @deprecated Use your own AJV instance in `validators`
	 */
	ajv?: Ajv;
	/**
	 * The amount of time that Lambda allows a function to run before stopping it.
	 * The default is 3 seconds. The maximum allowed value is 30 seconds.
	 *
	 * Consider using a `QueueHandler` for a timeout larger than 30 seconds.
	 */
	timeout?: number;

	/** @deprecated Use `validators` instead */
	schemas?: {
		body?: JSONSchemaType<B>;
		query?: JSONSchemaType<Q>;
		response?: JSONSchemaType<R>;
	};

	validators?: {
		body?: (body: unknown) => B;
		query?: (query: unknown) => Q;
		response?: (response: unknown) => R;
	};
}

export type ApiHandlerAuthorizer<
	B,
	Q,
	P extends ReadonlyArray<string>,
	A,
	R,
> = (
	event: ParsedApiEvent<B, Q, P>,
	handlerOptions: ApiHandlerOptions<B, Q, A, P, R>,
) => A | false;

export interface ApiHandlerOptions<B, Q, A, P extends ReadonlyArray<string>, R>
	extends ApiHandlerDefinition<B, Q, R> {
	authorizer?: ApiHandlerAuthorizer<B, Q, P, A, R>;
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

export type ParsedApiEvent<
	B,
	Q,
	P extends ReadonlyArray<string>,
	A = never,
> = Omit<ValidatedApiEvent<B, Q, A, P>, 'input'> & {
	input: Omit<ValidatedApiEvent<B, Q, A, P>['input'], 'auth'>;
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
	const {
		schemas,
		authorizer,
		ajv: customAjv,
		validators,
		...definition
	} = options;

	const ajvValidators: AjvValidators<B, Q> = {};

	if (schemas && schemas.body) {
		ajvValidators.body = (customAjv ?? ajv).compile(schemas.body);
	}

	if (schemas && schemas.query) {
		ajvValidators.query = (customAjv ?? ajv).compile(schemas.query);
	}

	const wrappedHandler: APIGatewayProxyHandlerV2 = async (event, context) => {
		try {
			const validatedParameters = checkPathParameters<P>(
				event.pathParameters,
				definition.pathParameters,
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

			let validateBodyResult: ValidationResult<B> = {
				success: true,
				data: event.body as unknown as B,
			};
			let validateQueryResult: ValidationResult<Q> = {
				success: true,
				data: queryBody as Q,
			};
			if (validators) {
				validateBodyResult = validateInput(validators.body, event.body);
				validateQueryResult = validateInput(validators.query, queryBody);
			} else if (ajvValidators) {
				validateBodyResult = validateDeprecatedInput(
					ajvValidators.body,
					event.body,
				);
				validateQueryResult = validateDeprecatedInput(
					ajvValidators.query,
					queryBody,
				);
			}

			if (!validateBodyResult.success) {
				return FailedResponse(validateBodyResult.error, { statusCode: 400 });
			}
			if (!validateQueryResult.success) {
				return FailedResponse(validateQueryResult.error, { statusCode: 400 });
			}

			const parsedEvent: ParsedApiEvent<B, Q, P> = {
				...event,
				input: {
					body: validateBodyResult.data,
					query: validateQueryResult.data,
					path: validatedParameters,
				},
			};

			let auth = undefined as unknown as A;
			if (authorizer) {
				try {
					const authResult = authorizer(parsedEvent, options);
					if (authResult) {
						auth = authResult;
					} else {
						return FailedResponse('Unauthorized', { statusCode: 403 });
					}
				} catch {
					return FailedResponse('Unauthorized', { statusCode: 403 });
				}
			}

			const validatedEvent: ValidatedApiEvent<B, Q, A, P> = {
				...event,
				input: {
					...parsedEvent.input,
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
			validators,
			schemas,
		},
		type: HandlerTypes.API as const,
	});
}

type ValidationResult<T> =
	| { success: false; error: unknown }
	| { success: true; data: T };

/**
 * Validate the input for our query or our body
 * @param validator
 * @param input
 * @returns
 */
function validateInput<T>(
	validator?: (value: any) => T,
	input?: string | unknown,
): ValidationResult<T> {
	if (!validator) {
		return { success: true, data: input as T };
	}
	/**
	 * Assume any string inputs are JSON
	 */
	if (typeof input === 'string') {
		input = JSON.parse(input);
	}

	try {
		const validatedInput = validator(input);
		if (validatedInput) {
			return { success: true, data: validatedInput };
		}
		throw new Error('Input validation failed');
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? { message: error.message } : error,
		};
	}
}

/**
 * Validate the input for our query or our body depending
 * @param validator
 * @param input
 * @returns
 * @deprecated
 */
function validateDeprecatedInput<T>(
	validator?: ValidateFunction<T>,
	input?: string | unknown,
): ValidationResult<T> {
	if (!validator) {
		return { success: true, data: input as unknown as T };
	}
	/**
	 * Assume any string inputs are JSON
	 */
	if (typeof input === 'string') {
		input = JSON.parse(input);
	}

	if (validator(input)) {
		return { success: true, data: input };
	}
	const [validationError] = validator.errors ?? [];
	if (validationError) {
		return { success: false, error: validationError };
	}
	throw new Error('Unknown error running AJV validator for input');
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
