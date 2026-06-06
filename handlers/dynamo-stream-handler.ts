import type {
	DynamoDBBatchItemFailure,
	DynamoDBRecord,
	DynamoDBStreamEvent,
	DynamoDBStreamHandler,
} from 'aws-lambda';
import { AsyncHandler, HandlerDefinition, HandlerTypes } from './handler';

export interface DynamoStreamHandlerDefinition extends HandlerDefinition {
	/**
	 * The logical name used to reference the source DynamoDB table.
	 *
	 * This is a key into the `tables` map configured on the `LambdaService`,
	 * not a CDK construct. The table itself (with its stream enabled) is
	 * supplied where the service is created.
	 */
	tableName: string;

	/**
	 * Where to begin reading the stream.
	 *
	 * Only `TRIM_HORIZON` and `LATEST` are valid for DynamoDB streams.
	 * `LATEST` can miss events while the event source mapping is being
	 * created or updated (stream polling is eventually consistent), so
	 * `TRIM_HORIZON` is recommended.
	 *
	 * @default 'TRIM_HORIZON'
	 */
	startingPosition?: 'TRIM_HORIZON' | 'LATEST';

	/**
	 * The largest number of records that Lambda retrieves from the stream when
	 * invoking the function.
	 *
	 * Valid Range: Minimum value of 1. Maximum value of 10,000.
	 *
	 * @default 100
	 */
	batchSize?: number;

	/**
	 * The maximum amount of time, in seconds, to gather records before invoking
	 * the function.
	 *
	 * Valid Range: Minimum value of 0. Maximum value of 300 (5 minutes).
	 *
	 * @default - no batching window
	 */
	maxBatchingWindow?: number;

	/**
	 * The maximum number of times to retry a failing batch before the records
	 * expire or are sent to an on-failure destination.
	 *
	 * Valid Range: -1 (infinite) or 0 to 10,000.
	 *
	 * @default -1 (infinite, until the record expires in the stream)
	 */
	retryAttempts?: number;

	/**
	 * If the function returns an error, split the batch in two and retry each
	 * half separately.
	 *
	 * @default false
	 */
	bisectBatchOnError?: boolean;

	/**
	 * The number of batches to process from each shard concurrently.
	 *
	 * Valid Range: Minimum value of 1. Maximum value of 10. In-order
	 * processing is still guaranteed per partition (and sort) key.
	 *
	 * @default 1
	 */
	parallelizationFactor?: number;

	/**
	 * The maximum age, in seconds, of a record that Lambda sends to the
	 * function.
	 *
	 * Valid Range: 60 to 604,800 (7 days), or -1 for infinite. The DynamoDB
	 * stream data retention limit is 24 hours regardless of this value.
	 *
	 * @default -1 (infinite)
	 */
	maxRecordAge?: number;
}

export type DynamoStreamHandlerEvent = DynamoDBStreamEvent;

/**
 * Records that failed to process and should be retried.
 *
 * DynamoDB streams are ordered and retried by checkpoint: when records are
 * returned here, Lambda checkpoints to the record with the **lowest** sequence
 * number and retries **all** records from that point forward. Records that
 * succeeded but sit after the earliest failure will be delivered again, so the
 * handler must be idempotent (delivery is at-least-once).
 */
export type DynamoStreamHandlerResponse = { retry: DynamoDBRecord[] } | void;

export type DynamoStreamHandlerWithDefinition = DynamoDBStreamHandler & {
	type: HandlerTypes.DynamoStream;
	definition: DynamoStreamHandlerDefinition;
};

/**
 * Map records to the partial-batch-failure shape Lambda expects.
 *
 * The `itemIdentifier` for a DynamoDB stream record is its `SequenceNumber`.
 * Records without one are skipped (nothing can be reported for them).
 */
function toBatchItemFailures(
	records: DynamoDBRecord[],
): DynamoDBBatchItemFailure[] {
	const failures: DynamoDBBatchItemFailure[] = [];
	for (const record of records) {
		const sequenceNumber = record.dynamodb?.SequenceNumber;
		if (sequenceNumber) {
			failures.push({ itemIdentifier: sequenceNumber });
		}
	}
	return failures;
}

/**
 * Create a handler for processing records from a DynamoDB stream.
 *
 * Records are passed through raw (images remain in DynamoDB `AttributeValue`
 * form). Return a `retry` list to report the records that failed; everything
 * else in the batch is treated as processed. If the handler throws, the entire
 * batch is reported as failed and retried.
 *
 * Because retries are checkpoint based and delivery is at-least-once, the
 * handler must be idempotent. See {@link DynamoStreamHandlerResponse}.
 */
export function DynamoStreamHandler(
	options: DynamoStreamHandlerDefinition,
	handler: AsyncHandler<DynamoStreamHandlerEvent, DynamoStreamHandlerResponse>,
): DynamoStreamHandlerWithDefinition {
	const wrappedHandler: DynamoDBStreamHandler = async (event, context) => {
		try {
			const response = await handler(event, context);
			if (!response || response.retry.length === 0) {
				return { batchItemFailures: [] };
			}
			return {
				batchItemFailures: toBatchItemFailures(response.retry),
			};
		} catch (error) {
			console.error(error);
			/**
			 * If the handler fails to run we'll mark the whole batch as failed
			 * so it gets retried from the start.
			 */
			return {
				batchItemFailures: toBatchItemFailures(event.Records),
			};
		}
	};

	return Object.assign(wrappedHandler, {
		type: HandlerTypes.DynamoStream as const,
		definition: options,
	});
}
