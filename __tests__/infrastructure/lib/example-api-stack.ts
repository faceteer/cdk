import { Stack, StackProps } from 'aws-cdk-lib';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { AttributeType, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { LambdaService } from '../../../constructs';

interface P extends StackProps {
	handlerPath: string;
}

export class ExampleApiStack extends Stack {
	readonly service: LambdaService;
	constructor(scope: Construct, id: string, props: P) {
		super(scope, id, props);

		this.service = new LambdaService(this, 'HelloWorld', {
			handlersFolder: props.handlerPath,
			eventBuses: {
				foobar: new EventBus(this, 'testEB', {
					eventBusName: 'foobar',
				}),
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
