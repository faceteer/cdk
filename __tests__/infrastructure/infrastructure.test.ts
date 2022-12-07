import path from 'path';
import { LambdaService } from '../../constructs';
import { Construct } from 'constructs';
import { App, Stack } from 'aws-cdk-lib';
import { EventBus } from 'aws-cdk-lib/aws-events';

class ExampleStack extends Stack {
	readonly service: LambdaService;

	constructor(scope: Construct, id: string) {
		super(scope, id);

		const basePath = path.join(__dirname, '../../fixtures/');

		this.service = new LambdaService(this, 'ExampleService', {
			handlersFolder: basePath,
			eventBuses: {
				'event-bus-name': new EventBus(this, 'ExampleBus'),
			},
		});
	}
}

const app = new App();

describe('Create Service', () => {
	test('All expected handlers exist', () => {
		const stack = new ExampleStack(app, 'ExampleStack');

		expect(stack.service.functions).toHaveLength(7);
	});
});
