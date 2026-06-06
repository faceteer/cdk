import path from 'path';
import { LambdaService } from '../../constructs';
import { Construct } from 'constructs';
import { App, Stack } from 'aws-cdk-lib';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { AttributeType, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Template } from 'aws-cdk-lib/assertions';

class ExampleStack extends Stack {
	readonly service: LambdaService;

	constructor(scope: Construct, id: string) {
		super(scope, id);

		const basePath = path.join(__dirname, '../../fixtures/example');

		this.service = new LambdaService(this, 'ExampleService', {
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

const app = new App();

describe('Create Service', () => {
	test('Logical Ids remain unchanged', () => {
		const stack = new ExampleStack(app, 'ExampleStack');

		const LogicalIds = Object.keys(
			Template.fromStack(stack).findResources('AWS::Lambda::Function'),
		);

		expect(LogicalIds).toMatchSnapshot();
	});
});
