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
- Releases are automated — see [Releasing](#releasing) for the full process.

## Architecture Overview

This is a TypeScript CDK v2 library (`@faceteer/cdk`) that provides constructs and helpers for building Lambda-powered serverless services on AWS. The library requires Node.js 20+ and follows a handler-based architecture where different types of Lambda functions are defined using specific handler patterns.

### Core Concepts

**LambdaService**: The main construct that orchestrates multiple Lambda functions. It automatically discovers handlers in a specified folder and creates the appropriate AWS resources (API Gateway, SQS queues, SNS topics, EventBridge rules, etc.).

**Handler Types**: The library supports 6 handler types:
- `ApiHandler` - HTTP API endpoints (GET/POST/PUT/PATCH/DELETE)
- `QueueHandler` - SQS queue message processing
- `EventHandler` - EventBridge event processing
- `CronHandler` - Scheduled Lambda functions
- `NotificationHandler` - SNS topic subscribers
- `DynamoStreamHandler` - DynamoDB stream processing (table referenced via the `tables` map on `LambdaService`)

**Handler Discovery**: The `extractHandlers` function automatically scans a directory for files matching the pattern `*.handler.ts` and creates handler definitions based on the exported `handler` object.

### Key Components

**constructs/**: CDK constructs for different Lambda function types
- `LambdaService` - Main service orchestrator
- `ServiceApiFunction` - API Gateway-integrated Lambda
- `ServiceQueueFunction` - SQS-integrated Lambda
- `ServiceNotificationFunction` - SNS-integrated Lambda
- `ServiceCronFunction` - EventBridge-scheduled Lambda
- `ServiceEventFunction` - EventBridge event-triggered Lambda
- `ServiceDynamoStreamFunction` - DynamoDB stream-triggered Lambda

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

## Releasing

Releases are automated. `.github/workflows/publish.yml` fires on `v*` tag pushes:
it runs the Jest tests, **verifies the tag matches `package.json` version**,
extracts the matching `CHANGELOG.md` section, publishes to npm with the right
dist-tag via npm Trusted Publishing (OIDC — no `NPM_TOKEN`), then creates a
GitHub Release with those notes. Prereleases are flagged with `--prerelease`.

Notes extraction runs **before** publishing, so a stable release with no
`CHANGELOG.md` section aborts before anything reaches npm. A prerelease
(`-alpha`/`-beta`/`-rc`) without a section does not fail — it gets a generic
release body — so dry-run tags stay frictionless.

### npm dist-tags

The dist-tag is derived from the version string:

- `X.Y.Z` → `latest`
- `X.Y.Z-alpha.N` → `alpha`
- `X.Y.Z-beta.N` → `beta`
- `X.Y.Z-rc.N` → `rc`

### Cutting a release (LLM-driven)

`main` is protected, so the version bump and changelog land via PR; the tag is
pushed only after that merges. Run these steps in order — the user reviews the
CHANGELOG draft before anything is pushed.

1. **Draft the CHANGELOG entry.** Read `git log <last-tag>..HEAD` and group
   changes under Keep a Changelog sub-headings (`Added` / `Changed` /
   `Changed (breaking)` / `Fixed` / `Removed` / `Infrastructure`). Reference
   issue/PR numbers where commit messages mention them. Write the draft into the
   `## [Unreleased]` block in `CHANGELOG.md`.
2. **Rename the block.** `## [Unreleased]` → `## [X.Y.Z] - YYYY-MM-DD`, open a
   fresh empty `## [Unreleased]` above it, and add/refresh the compare-links at
   the bottom of the file (`[unreleased]` → `compare/vX.Y.Z...HEAD`, and a
   `[X.Y.Z]` link).
3. **Bump `package.json` `version`** to `X.Y.Z` (the tag must match exactly, or
   the workflow fails).
4. **Sanity-check** the release-notes extractor returns non-empty output:

   ```sh
   awk -v ver="X.Y.Z" '$0 ~ "^## \\[" ver "\\]" {inside=1; next} inside && (/^## \[/ || /^\[[^]]+\]:/) {exit} inside' CHANGELOG.md
   ```

5. **Open a PR** with the version bump + CHANGELOG and merge it to `main`.
6. **Tag the merged commit and push the tag:** `git tag vX.Y.Z && git push origin vX.Y.Z`.
   The publish workflow takes it from there (publish + GitHub Release).