# @faceteer/cdk

A TypeScript CDK v2 library that provides constructs and helpers for building Lambda-powered serverless services on AWS. This library simplifies the creation of serverless architectures by automatically discovering handlers and creating the appropriate AWS resources.

## Installation

```bash
npm install @faceteer/cdk
```

**Requirements:** Node.js 20+

## Quick Start

Create a Lambda service with automatic handler discovery:

```typescript
import { LambdaService } from '@faceteer/cdk';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new LambdaService(this, 'MyService', {
      handlersFolder: './src/handlers',
    });
  }
}
```

## Core Concepts

### LambdaService

The main construct that orchestrates multiple Lambda functions. It automatically discovers handlers in a specified folder and creates the appropriate AWS resources (API Gateway, SQS queues, SNS topics, EventBridge rules, etc.).

### Handler Types

The library supports 5 handler types, each creating different AWS integrations:

#### 1. ApiHandler - HTTP API endpoints
Creates Lambda functions integrated with API Gateway for REST endpoints.

```typescript
// src/handlers/get-user.handler.ts
import { ApiHandler, SuccessResponse } from '@faceteer/cdk';

export const handler = ApiHandler(
  {
    name: 'GetUser',
    method: 'GET',
    route: '/users/{userId}',
    pathParameters: ['userId'],
    memorySize: 512,
  },
  async (event) => {
    const { userId } = event.input.path;
    return SuccessResponse({ user: { id: userId } });
  }
);
```

#### 2. QueueHandler - SQS message processing
Creates Lambda functions triggered by SQS queue messages.

```typescript
// src/handlers/process-user.handler.ts
import { QueueHandler } from '@faceteer/cdk';
import { SQSClient } from '@aws-sdk/client-sqs';

interface User {
  userId: string;
  email: string;
}

export const handler = QueueHandler(
  {
    queueName: 'processUser',
    memorySize: 1024,
    timeout: 300,
    sqs: new SQSClient({ region: 'us-east-1' }),
    validator: (body: any) => body as User,
  },
  async (event) => {
    // Process messages
    console.log(`Processing ${event.ValidMessages.length} messages`);
    
    return {
      retry: event.ValidMessages.filter(msg => shouldRetry(msg)),
    };
  }
);
```

#### 3. EventHandler - EventBridge event processing
Creates Lambda functions triggered by EventBridge events.

```typescript
// src/handlers/user-created.handler.ts
import { EventHandler } from '@faceteer/cdk';

export const handler = EventHandler(
  {
    name: 'UserCreatedEvent',
    eventPattern: {
      source: ['user.service'],
      'detail-type': ['User Created'],
    },
    eventBusName: 'default',
  },
  async (event) => {
    console.log('User created:', event.detail);
  }
);
```

#### 4. CronHandler - Scheduled functions
Creates Lambda functions triggered by EventBridge scheduled rules.

```typescript
// src/handlers/daily-cleanup.handler.ts
import { CronHandler } from '@faceteer/cdk';

export const handler = CronHandler(
  {
    name: 'DailyCleanup',
    schedule: {
      expressionString: 'cron(0 2 * * ? *)', // Daily at 2 AM
    },
  },
  async (event) => {
    console.log('Running daily cleanup...');
  }
);
```

#### 5. NotificationHandler - SNS subscribers
Creates Lambda functions triggered by SNS topic messages.

```typescript
// src/handlers/email-notification.handler.ts
import { NotificationHandler } from '@faceteer/cdk';

export const handler = NotificationHandler(
  {
    name: 'EmailNotification',
    topicName: 'email-notifications',
    memorySize: 256,
  },
  async (event) => {
    console.log(`Processing ${event.ValidMessages.length} notifications`);
  }
);
```

### Handler Discovery

The library automatically discovers handlers using the `extractHandlers` function:

1. Scans the specified handlers folder for files matching `*.handler.ts`
2. Imports each handler file and extracts the exported `handler` object
3. Creates handler definitions with metadata and file paths
4. Handles naming conflicts by generating unique names

### Response Utilities

Standardized response helpers for consistent API responses:

```typescript
import { SuccessResponse, FailedResponse } from '@faceteer/cdk';

// Success response
return SuccessResponse({ data: result });

// Error response
return FailedResponse('User not found', 404);
```

## Advanced Configuration

### Authentication

Configure JWT or Lambda authorizers:

```typescript
new LambdaService(this, 'MyService', {
  handlersFolder: './src/handlers',
  authorizer: {
    // JWT Authorizer
    identitySource: ['$request.header.Authorization'],
    audience: ['api-client'],
    issuer: 'https://your-auth-provider.com',
  },
  // OR Lambda Authorizer
  // authorizer: {
  //   fn: authorizerFunction,
  //   identitySource: ['$request.header.Authorization'],
  // },
});
```

### Custom Domains

```typescript
new LambdaService(this, 'MyService', {
  handlersFolder: './src/handlers',
  domain: {
    certificate: certificate,
    domainName: 'api.example.com',
    route53Zone: hostedZone,
  },
});
```

### VPC Configuration

```typescript
new LambdaService(this, 'MyService', {
  handlersFolder: './src/handlers',
  network: {
    vpc: vpc,
    vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
    securityGroups: [securityGroup],
  },
});
```

### Default Settings

Configure defaults that apply to all handlers:

```typescript
new LambdaService(this, 'MyService', {
  handlersFolder: './src/handlers',
  defaults: {
    memorySize: 512,
    timeout: 30,
    runtime: 'nodejs20.x',
    logRetentionDuration: LogRetentionDays.ONE_WEEK,
  },
});
```

### Event Buses

Configure event buses for EventHandlers:

```typescript
new LambdaService(this, 'MyService', {
  handlersFolder: './src/handlers',
  eventBuses: {
    'user-events': EventBus.fromEventBusName(this, 'UserBus', 'user-events'),
    'order-events': new EventBus(this, 'OrderBus'),
  },
});
```

## Input Validation

Handlers support custom validation functions for type-safe input processing:

```typescript
interface CreateUserRequest {
  email: string;
  name: string;
}

// Custom validation function
function validateCreateUser(body: unknown): CreateUserRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Body must be an object');
  }
  
  const { email, name } = body as any;
  
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required and must be a string');
  }
  
  if (!name || typeof name !== 'string') {
    throw new Error('Name is required and must be a string');
  }
  
  return { email, name };
}

export const handler = ApiHandler(
  {
    name: 'CreateUser',
    method: 'POST',
    route: '/users',
    validators: {
      body: validateCreateUser,
    },
  },
  async (event) => {
    // event.input.body is now typed and validated
    const user = await createUser(event.input.body);
    return SuccessResponse({ user });
  }
);
```

## Environment Variables

Add environment variables to all functions in a service:

```typescript
const service = new LambdaService(this, 'MyService', { /* ... */ });
service.addEnvironment('DATABASE_URL', databaseUrl);
service.addEnvironment('API_KEY', apiKey);
```

## File Structure

```
src/
├── handlers/
│   ├── api/
│   │   ├── get-users.handler.ts
│   │   └── create-user.handler.ts
│   ├── queues/
│   │   └── process-user.handler.ts
│   ├── events/
│   │   └── user-created.handler.ts
│   └── crons/
│       └── daily-cleanup.handler.ts
└── lib/
    └── my-stack.ts
```

## Testing

The library includes comprehensive test utilities. Run tests with:

```bash
npm test
```

## Development Commands

- `npm run build` - Build TypeScript files
- `npm run test` - Run tests with coverage
- `npm run test:ci` - Run tests in CI mode

## License

MIT
