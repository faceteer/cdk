import { EventHandler, EventHandlerEvent } from '../../handlers';
import { EventBridgeEvent } from 'aws-lambda';

interface AddedUserEvent {
	userId: string;
	token: string;
}

describe('Event Handler', () => {
	beforeEach(() => {
		process.env = {
			...process.env,
			ACCOUNT_ID: '156745',
			AWS_REGION: 'us-east-1',
		};
	});

	test('Handles valid messages', async () => {
		const user = { userId: '454', token: 'xxyyyzzz' };

		const internalHandler = jest.fn(
			async (event: EventHandlerEvent<AddedUserEvent>): Promise<void> => {
				expect(event.detail).toEqual(user);
				return;
			},
		);

		const handler = EventHandler(
			{
				name: 'test-event',
				eventPattern: { detailType: ['test'] },
				validator: (body) => {
					return body as EventBridgeEvent<string, AddedUserEvent>;
				},
			},
			internalHandler,
		);

		await handler(mockEventBridgeEvent(user), {} as any, () => {});
		expect(internalHandler).toBeCalled();
	});

	test('Handles invalid messages', async () => {
		const user = {
			userId: '454',
			notSupposedToBeHere: '',
		} as unknown as AddedUserEvent;

		const internalHandler = jest.fn(async (): Promise<void> => {
			return;
		});

		const handler = EventHandler(
			{
				name: 'test-event',
				eventPattern: {
					detailType: ['test'],
				},
				validator: (detail) => {
					if ('userId' in detail && 'token' in detail) {
						return detail as EventBridgeEvent<string, AddedUserEvent>;
					}
					throw new Error('Validation failed');
				},
			},
			internalHandler,
		);

		await handler(mockEventBridgeEvent(user), {} as any, () => {});

		expect(internalHandler).toBeCalledTimes(0);
	});

	let mockCounter = 0;

	/**
	 * Generate a mock Event Bridge event
	 * @param body
	 * @param attempts
	 * @returns
	 */
	function mockEventBridgeEvent<T>(detail: T): EventBridgeEvent<string, T> {
		mockCounter++;
		return {
			version: '0',
			id: `${mockCounter}53dc4d37-cffa-4f76-80c9-8b7d4a4d2eaa`,
			'detail-type': 'Scheduled Event',
			source: 'aws.events',
			account: '123456789012',
			time: '2015-10-08T16:53:06Z',
			region: 'us-east-1',
			resources: [
				'arn:aws:events:us-east-1:123456789012:rule/my-scheduled-rule',
			],
			detail,
		};
	}
});
