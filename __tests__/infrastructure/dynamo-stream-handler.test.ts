import path from 'path';
import { App, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AttributeType, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { Template } from 'aws-cdk-lib/assertions';
import { LambdaService } from '../../constructs';

class StreamStack extends Stack {
	readonly service: LambdaService;

	constructor(scope: Construct, id: string) {
		super(scope, id);

		const basePath = path.join(__dirname, '../../fixtures/example');

		this.service = new LambdaService(this, 'StreamService', {
			handlersFolder: basePath,
			eventBuses: {
				'event-bus-name': new EventBus(this, 'ExampleBus'),
			},
			tables: {
				users: new Table(this, 'UsersTable', {
					partitionKey: { name: 'id', type: AttributeType.STRING },
					stream: StreamViewType.NEW_AND_OLD_IMAGES,
				}),
			},
		});
	}
}

describe('DynamoDB stream handler infrastructure', () => {
	test('creates an event source mapping wired to the table stream', () => {
		const app = new App();
		const stack = new StreamStack(app, 'StreamStack');
		const template = Template.fromStack(stack);

		template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
			StartingPosition: 'TRIM_HORIZON',
			FunctionResponseTypes: ['ReportBatchItemFailures'],
		});
	});
});

export {};
