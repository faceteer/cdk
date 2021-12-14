export interface Message<T> {
	/**
	 * The validated message body
	 */
	body: T;
	/**
	 * How many times this message has bee
	 */
	attempts: number;
}

/**
 * A message that has been validated
 */
export interface ValidatedMessage<T> extends Message<T> {
	/**
	 * Id of the SQS record containing the
	 * message that's used for retrying messages
	 */
	messageId: string;
}

/**
 * A message that has permanently failed to process
 */
export interface FailedMessage extends Message<unknown> {
	/**
	 * Id of the record containing the
	 * message that's used for retrying messages
	 */
	messageId?: string;
	/**
	 * The error thrown when trying to validate a message
	 */
	error: unknown;
}

export interface InvalidMessage extends Message<unknown> {
	/**
	 * Id of the record containing the
	 * message that's used for retrying messages
	 */
	messageId: string;
	/**
	 * The error thrown when trying to validate a message
	 */
	error: unknown;
}
