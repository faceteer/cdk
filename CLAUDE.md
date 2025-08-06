# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build and Development
- `npm run build` - Clean and build TypeScript files
- `npm run build:clean` - Clean TypeScript build artifacts
- `npm test` - Run Jest tests with coverage
- `npm test:ci` - Run tests in CI mode with coverage and codecov

### Publishing
- `npm run prepublishOnly` - Automatically runs before publishing (builds the project)

## Architecture Overview

This is a TypeScript CDK v2 library (`@faceteer/cdk`) that provides constructs and helpers for building Lambda-powered serverless services on AWS. The library requires Node.js 20+ and follows a handler-based architecture where different types of Lambda functions are defined using specific handler patterns.

### Core Concepts

**LambdaService**: The main construct that orchestrates multiple Lambda functions. It automatically discovers handlers in a specified folder and creates the appropriate AWS resources (API Gateway, SQS queues, SNS topics, EventBridge rules, etc.).

**Handler Types**: The library supports 5 handler types:
- `ApiHandler` - HTTP API endpoints (GET/POST/PUT/PATCH/DELETE)
- `QueueHandler` - SQS queue message processing
- `EventHandler` - EventBridge event processing
- `CronHandler` - Scheduled Lambda functions
- `NotificationHandler` - SNS topic subscribers

**Handler Discovery**: The `extractHandlers` function automatically scans a directory for files matching the pattern `*.handler.ts` and creates handler definitions based on the exported `handler` object.

### Key Components

**constructs/**: CDK constructs for different Lambda function types
- `LambdaService` - Main service orchestrator
- `ServiceApiFunction` - API Gateway-integrated Lambda
- `ServiceQueueFunction` - SQS-integrated Lambda
- `ServiceNotificationFunction` - SNS-integrated Lambda
- `ServiceCronFunction` - EventBridge-scheduled Lambda
- `ServiceEventFunction` - EventBridge event-triggered Lambda

**handlers/**: Handler factory functions and type definitions
- Each handler type has validation, path parameter checking, and error handling
- Supports JSON schema validation using AJV
- Type-safe event parsing and response handling

**extract/**: Handler discovery and metadata extraction
- `extractHandlers()` scans directories for handler files
- Generates unique names and handles naming conflicts
- Creates handler definitions with file paths and metadata

**response/**: Standardized response utilities
- `SuccessResponse` and `FailedResponse` helpers
- Consistent error handling across all handler types

### Handler File Patterns

Handler files must:
1. Be named `*.handler.ts`
2. Export a `handler` variable created using the appropriate handler factory
3. Be located in the handlers folder specified in `LambdaService` props

Example API handler:
```typescript
export const handler = ApiHandler(
  {
    name: 'GetUsers',
    method: 'GET',
    route: '/users',
    // ... other config
  },
  async (event) => {
    // Handler implementation
    return SuccessResponse({ users: [] });
  }
);
```

### Testing

The project uses Jest with TypeScript support:
- Tests are in `__tests__/` directories
- Fixtures in `fixtures/` for testing handler discovery
- Coverage reporting enabled
- Snapshot testing for infrastructure