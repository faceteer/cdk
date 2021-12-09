import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

export interface FailedResponseOptions {
	statusCode?: number;
	headers?: Record<string, boolean | number | string>;
}

export function FailedResponse<T = unknown>(
	body: T,
	{ headers = {}, statusCode = 500 }: FailedResponseOptions = {},
): APIGatewayProxyStructuredResultV2 {
	const responseHeaders: Record<string, boolean | number | string> = {
		'Content-Type': 'application/json',
		...headers,
	};

	try {
		/**
		 * If the body is a string, number, or boolean value we'll wrap
		 * it inside of an object to make sure valid JSON is returned
		 */
		if (
			typeof body === 'string' ||
			typeof body === 'number' ||
			typeof body === 'boolean'
		) {
			return {
				body: JSON.stringify({ error: body }),
				statusCode,
				headers: responseHeaders,
			};
		}

		if (body instanceof Error) {
			return {
				body: JSON.stringify({
					error: {
						message: body.message,
						name: body.name,
						stack: body.stack,
					},
				}),
				statusCode,
				headers: responseHeaders,
			};
		}

		return {
			body: JSON.stringify(body),
			statusCode,
			headers: responseHeaders,
		};
	} catch (error) {
		/**
		 * If we get passed a body that can't be stringified we'll get an error
		 */
		if (error instanceof Error) {
			return {
				body: JSON.stringify({ error: error.message }),
				headers: responseHeaders,
				statusCode: 500,
			};
		}
		return {
			body: JSON.stringify({
				error: 'Unhandled Error Building Failure Response',
			}),
			headers: responseHeaders,
			statusCode: 500,
		};
	}
}
