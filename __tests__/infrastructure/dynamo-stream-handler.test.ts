import path from 'path';
import { App, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AttributeType, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { Template } from 'aws-cdk-lib/assertions';
import { LambdaService } from '../../constructs';

const basePath = path.join(__dirname, '../../fixtures/example');

class StreamStack extends Stack {
	readonly service: LambdaService;

	constructor(scope: Construct, id: string, opts: { withUsersTable: boolean }) {
		super(scope, id);

		const usersTable = new Table(this, 'UsersTable', {
			partitionKey: { name: 'id', type: AttributeType.STRING },
			stream: StreamViewType.NEW_AND_OLD_IMAGES,
		});

		this.service = new LambdaService(this, 'StreamService', {
			handlersFolder: basePath,
			eventBuses: {
				'event-bus-name': new EventBus(this, 'ExampleBus'),
			},
			// Either wire the table the fixture references, or a mismatched key
			// to exercise the resolution error path.
			tables: opts.withUsersTable
				? { users: usersTable }
				: { other: usersTable },
		});
	}
}

describe('DynamoDB stream handler infrastructure', () => {
	test('creates an event source mapping wired to the table stream', () => {
		const app = new App();
		const stack = new StreamStack(app, 'StreamStack', {
			withUsersTable: true,
		});
		const template = Template.fromStack(stack);

		template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
			StartingPosition: 'TRIM_HORIZON',
			FunctionResponseTypes: ['ReportBatchItemFailures'],
		});
	});

	test('throws a clear error when the referenced table is not configured', () => {
		const app = new App();
		expect(
			() => new StreamStack(app, 'MissingTableStack', { withUsersTable: false }),
		).toThrow(/Could not find the table "users"/);
	});
});

export {};
