import { JSONSchemaType } from 'ajv';
import type {
	CloudFrontFunctionsEvent,
	CloudFrontRequestHandler,
} from 'aws-lambda';
import { HandlerDefinition, HandlerTypes } from './handler';

export interface EdgeHandlerDefinition<Q = never> extends HandlerDefinition {
	/**
	 * Event type for when this function is invoked
	 */
	eventType: 'VIEWER_REQUEST' | 'VIEWER_RESPONSE';
	/**
	 * Id of the distribution this handler to associate with
	 */
	distributionId: string;

	/**
	 * The generated domain name, such as d111111abcdef8.cloudfront.net, of the distribution this handler to associated with
	 */
	distributionDomain: string;

	schemas: {
		query?: JSONSchemaType<Q>;
	};
}

export interface EdgeHandlerOptions<Q> extends EdgeHandlerDefinition<Q> {}

export type ValidatedEdgeEvent<Q> = CloudFrontFunctionsEvent & {
	input: {
		query: Q;
	};
};

export type EdgeHandlerWithDefinition<Q = never> = CloudFrontRequestHandler & {
	type: HandlerTypes.Edge;
	definition: EdgeHandlerDefinition<Q>;
};

/**
 * Creates a handler that will be attached to the service edge function
 * @param options
 * @param handler
 * @returns
 */
export function EdgeHandler<Q = unknown>(
	options: EdgeHandlerOptions<Q>,
	handler: CloudFrontRequestHandler,
): EdgeHandlerWithDefinition<Q> {
	const { schemas, ...definition } = options;

	return Object.assign(handler, {
		definition: {
			...definition,
			schemas,
		},
		type: HandlerTypes.Edge as const,
	});
}
