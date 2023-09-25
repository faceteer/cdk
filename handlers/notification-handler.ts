import { AsyncHandler, HandlerDefinition, HandlerTypes } from './handler';
import type { SnsEventSourceProps } from 'aws-cdk-lib/aws-lambda-event-sources';
import type { SNSEvent, SNSHandler } from 'aws-lambda';
import { InvalidMessage, ValidatedMessage } from './message';

export interface NotificationHandlerDefinition extends HandlerDefinition {
	/** The name of the function */
	name: string;
	/**
	 * The name of the SNS topic that the function is subscribed to.
	 * @deprecated Use `topics` instead.
	 */
	topicName?: string;
	/**
	 * The topics to which this handler is subscribed.
	 */
	topics: Readonly<string[]>;
	/** An optional filter policy for the function */
	filterPolicy?: SnsEventSourceProps['filterPolicy'];
}

export interface NotificationHandlerOptions<T>
	extends NotificationHandlerDefinition {
	/**
	 * The validator must be able to validate any topic in the `topics` array.
	 */
	validator?: (topicName: string, messageBody: unknown) => T;
}

export type NotificationHandlerWithDefinition = SNSHandler & {
	type: HandlerTypes.Notification;
	definition: NotificationHandlerDefinition;
};

function defaultValidator<T>(): T {
	return undefined as unknown as T;
}

export type NotificationEvent<T> = SNSEvent & {
	/**
	 * Messages that have been validated
	 */
	ValidMessages: ValidatedMessage<T>[];
	/**
	 * Messages that failed to validate
	 */
	InvalidMessages: InvalidMessage[];
};

export function NotificationHandler<T>(
	options: NotificationHandlerOptions<T>,
	handler: AsyncHandler<NotificationEvent<T>, void>,
): NotificationHandlerWithDefinition {
	const { validator = defaultValidator, ...definition } = options;

	const wrappedHandler: SNSHandler = async (event, context, callback) => {
		const notificationEvent: NotificationEvent<T> = {
			Records: event.Records,
			InvalidMessages: [],
			ValidMessages: [],
		};
		try {
			for (const record of event.Records) {
				try {
					const validRecord = validator(
						record.Sns.Type,
						JSON.parse(record.Sns.Message),
					);
					notificationEvent.ValidMessages.push({
						attempts: 0,
						body: validRecord,
						messageId: record.Sns.MessageId,
					});
				} catch (error) {
					notificationEvent.InvalidMessages.push({
						attempts: 0,
						body: record.Sns.Message,
						error,
						messageId: record.Sns.MessageId,
					});
				}
			}
			await handler(notificationEvent, context);
		} catch (error) {
			callback(error as any);
		}
	};

	return Object.assign(wrappedHandler, {
		type: HandlerTypes.Notification as const,
		definition: definition,
	});
}

export {};
