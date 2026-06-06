# Changelog

All notable changes to `@faceteer/cdk` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

npm dist-tags track the most recent publish in each channel: `latest` points at the newest stable release, `alpha` / `beta` / `rc` at the newest prerelease of that kind.

## [Unreleased]

## [8.1.0] - 2026-06-05

### Added

- **`DynamoStreamHandler`** — a sixth handler type for processing DynamoDB streams. Records pass through raw (images stay in DynamoDB `AttributeValue` form); return a `retry` list to report failed records via partial batch response (handlers must be idempotent, since streams retry by checkpoint). The source table is referenced by name through a new `tables` map on `LambdaService`.

### Infrastructure

- The publish workflow now creates a GitHub Release whose body is the matching `CHANGELOG.md` section, and bumps `actions/checkout` / `actions/setup-node` from v4 to v6.

## [8.0.1] - 2026-04-19

### Fixed

- `NotificationHandler` now works on the Node 24 Lambda runtime ([#62](https://github.com/faceteer/cdk/issues/62)).

### Infrastructure

- Added a tag-triggered npm publish workflow using Trusted Publishing (OIDC), running on Node 24 ([#60](https://github.com/faceteer/cdk/issues/60), [#61](https://github.com/faceteer/cdk/issues/61)).

[unreleased]: https://github.com/faceteer/cdk/compare/v8.1.0...HEAD
[8.1.0]: https://github.com/faceteer/cdk/compare/v8.0.1...v8.1.0
[8.0.1]: https://github.com/faceteer/cdk/releases/tag/v8.0.1
