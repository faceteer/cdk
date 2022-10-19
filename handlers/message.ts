export type Message<T> = StandardMessage<T> | FifoMessage<T>;

export interface StandardMessage<T> {
	/**
	 * The validated message body
	 */
	body: T;
	/**
	 * How many times this message has bee
	 */
	attempts: number;
}

export interface FifoMessage<T> {
	/**
	 * The validated message body
	 */
	body: T;
	/**
	 * How many times this message has bee
	 */
	attempts: number;

	/**
	 * The tag that specifies that a message belongs to a specific message group.
	 * https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SendMessage.html#API_SendMessage_RequestParameters
	 */
	groupId: string;

	/**
	 * The token used for deduplication of sent messages.
	 * https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SendMessage.html#API_SendMessage_RequestParameters
	 */
	deduplicationId?: string;
}

export const isFifoMessage = <T>(
	message: Message<T>,
): message is FifoMessage<T> => 'groupId' in message;

/**
 * A message that has been validated
 */
export type ValidatedMessage<T> = Message<T> & {
	/**
	 * Id of the SQS record containing the
	 * message that's used for retrying messages
	 */
	messageId: string;
};

/**
 * A message that has permanently failed to process
 */
export type FailedMessage = Message<unknown> & {
	/**
	 * Id of the record containing the
	 * message that's used for retrying messages
	 */
	messageId?: string;
	/**
	 * The error thrown when trying to validate a message
	 */
	error: unknown;
};

export type InvalidMessage = Message<unknown> & {
	/**
	 * Id of the record containing the
	 * message that's used for retrying messages
	 */
	messageId: string;
	/**
	 * The error thrown when trying to validate a message
	 */
	error: unknown;
};
