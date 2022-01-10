export interface ISuccessResponse<T> {
	statusCode?: number | undefined;
	headers?:
		| {
				[header: string]: boolean | number | string;
		  }
		| undefined;
	body: T;
	bodyString: string;
	isBase64Encoded?: boolean | undefined;
	cookies?: string[] | undefined;
}

export interface SuccessResponseOptions {
	statusCode?: number;
	headers?: Record<string, boolean | number | string>;
}

export function SuccessResponse<T = unknown>(
	body: T,
	{ headers = {}, statusCode = 200 }: SuccessResponseOptions = {},
): ISuccessResponse<T> {
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
				body: body,
				bodyString: JSON.stringify({ message: body }),
				statusCode,
				headers: responseHeaders,
			};
		}

		return {
			body: body,
			bodyString: JSON.stringify(body),
			statusCode,
			headers: responseHeaders,
		};
	} catch (error) {
		/**
		 * If we get passed a body that can't be stringified we'll get an error
		 */
		if (error instanceof Error) {
			return {
				body: body,
				bodyString: JSON.stringify({ error: error.message }),
				headers: responseHeaders,
				statusCode: 500,
			};
		}

		return {
			body: body,
			bodyString: JSON.stringify({
				error: 'Unhandled Error Building Success Response',
			}),
			headers: responseHeaders,
			statusCode: 500,
		};
	}
}
