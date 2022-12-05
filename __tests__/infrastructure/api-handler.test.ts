import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ExampleApiStack } from './lib/example-api-stack';
import path from 'path';
import { ApiHandlerWithDefinition } from '../../handlers';

jest.spyOn(global.console, 'error');

const findResourceByType = (template: Template, type: string) =>
	Object.entries(template.findResources(type, {})).map(([o, r]) => ({
		logicalId: o,
		resource: r,
	}))[0];

describe('ApiLogicalIds', () => {
	test('Renaming a Lambda function should not change the logical id of its route or api gateway integration', () => {
		const app = new App();
		const app2 = new App();
		const v1Path = path.join(
			path.resolve(__dirname),
			'../../__mocks__/renaming/v1',
		);
		const v2Path = path.join(
			path.resolve(__dirname),
			'../../__mocks__/renaming/v2',
		);

		const stackv1 = new ExampleApiStack(app, 'ApiStack', {
			handlerPath: v1Path,
		});

		const stackv2 = new ExampleApiStack(app2, 'ApiStack', {
			handlerPath: v2Path,
		});

		const template1 = Template.fromStack(stackv1);
		const template2 = Template.fromStack(stackv2);

		const Lambdav1Integration = template1.findResources(
			'AWS::ApiGatewayV2::Integration',
			{},
		);
		const Lambdav2Integration = template2.findResources(
			'AWS::ApiGatewayV2::Integration',
			{},
		);

		const Lambdav1Route = template1.findResources(
			'AWS::ApiGatewayV2::Route',
			{},
		);
		const Lambdav2Route = template2.findResources(
			'AWS::ApiGatewayV2::Route',
			{},
		);

		const logicalId = (r: Record<string, any>) => Object.keys(r)[0];

		expect(logicalId(Lambdav1Integration)).toEqual(
			logicalId(Lambdav2Integration),
		);
		expect(logicalId(Lambdav1Route)).toEqual(logicalId(Lambdav2Route));
	});

	test('Lambdas with the same name but different routes should not conflict', () => {
		const app = new App();
		const app2 = new App();
		const v1Path = path.join(
			path.resolve(__dirname),
			'../../__mocks__/naming-conflict/v1',
		);
		const v2Path = path.join(
			path.resolve(__dirname),
			'../../__mocks__/naming-conflict/v2',
		);

		const stackv1 = new ExampleApiStack(app, 'ApiStack', {
			handlerPath: v1Path,
		});

		const stackv2 = new ExampleApiStack(app2, 'ApiStack', {
			handlerPath: v2Path,
		});

		const template1 = Template.fromStack(stackv1);
		const template2 = Template.fromStack(stackv2);

		const Lambdav1Route = template1.findResources(
			'AWS::ApiGatewayV2::Route',
			{},
		);
		const Lambdav2Route = template2.findResources(
			'AWS::ApiGatewayV2::Route',
			{},
		);

		const logicalId = (r: Record<string, any>) => Object.keys(r)[0];

		expect(logicalId(Lambdav1Route)).not.toEqual(logicalId(Lambdav2Route));
	});

	test('using the Logical ID CFNOverrides should set the exact contents of the logical ids of those resources', () => {
		const app = new App();
		const v1Path = path.join(
			path.resolve(__dirname),
			'../../__mocks__/override-logical-ids/',
		);

		const stack = new ExampleApiStack(app, 'ApiStack', {
			handlerPath: v1Path,
		});
		const template = Template.fromStack(stack);

		const module = require(path.join(
			v1Path,
			'./override-logical-ids.handler.ts',
		));

		const { definition } = module.handler as ApiHandlerWithDefinition;
		definition.cfnOverrides?.logicalIds?.function;
		definition.cfnOverrides?.logicalIds?.route;
		definition.cfnOverrides?.logicalIds?.integration;

		const fn = findResourceByType(template, 'AWS::Lambda::Function');
		const route = findResourceByType(template, 'AWS::ApiGatewayV2::Route');
		const integration = findResourceByType(
			template,
			'AWS::ApiGatewayV2::Integration',
		);

		expect(fn.logicalId).toEqual(definition.cfnOverrides?.logicalIds?.function);
		expect(route.logicalId).toEqual(definition.cfnOverrides?.logicalIds?.route);
		expect(integration.logicalId).toEqual(
			definition.cfnOverrides?.logicalIds?.integration,
		);
	});
});

export {};
