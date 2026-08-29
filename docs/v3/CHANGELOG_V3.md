# Changelog - DEVUP AI SDK V3

## [3.2.0] - 2026-08-29

### Added

- **Reasoning Fields in Chat & Streaming:** Added `reasoning_content?: string | null` to `ChatCompletionMessage` and `ChatCompletionChunkDelta`, exposing model thinking traces in both non-streaming and streaming chat completions.
- **Reasoning Tokens in Usage:** Added `reasoning_tokens?: number` to `TokenUsage`, supporting token accounting for providers that return reasoning token breakdowns.
- **Webhook Signature Verification:** Added `verifyWebhookSignature()` and `constructWebhookEvent()` standalone helpers alongside `client.webhooks` resource namespace for verifying inbound DEVUP AI webhook delivery callbacks. Implemented with Web Crypto API (`crypto.subtle`) for zero-dependency compatibility across Node.js 18+, Edge runtimes, Cloudflare Workers, Deno, Bun, and browsers.
- **`DevupWebhookVerificationError` Class:** Exported dedicated verification error class with granular `reason` codes (`malformed_header`, `timestamp_outside_tolerance`, `no_matching_signature`, `invalid_json`).
- **Webhook Payload Types:** Exported `WebhookEvent`, `WebhookSuccessPayload`, `WebhookErrorPayload`, and `WebhookUsage` interfaces.
- **`rerank.create` Restored:** The `rerank.create()` method has been restored as a first-class feature in the SDK, matching the newly deployed dedicated `/v1/rerank` backend endpoint. This supersedes the `3.0.0` deprecation notice which previously instructed users to route these requests through the generic `inference.run()` proxy.

## [3.0.0] - 2026-08-05

### Added

- **TypeScript & OpenAPI Alignment:** The SDK's public types are now strictly derived from the official DEVUP AI OpenAPI V1 contract (`openapi/devupai-v1.yaml`).
- **New `inference.run()` Method:** Provides a generic, unified interface to execute requests against DEVUP AI's specialized models.
- **`health.check()` Export:** Health check capabilities are now publicly exposed on the `client.health.check()` endpoint. Does not require `Authorization`.
- **`images.proxy()` Export:** Exposes DEVUP AI's image proxy service explicitly to securely download upstream assets. Returns a native `Response`. Does not require `Authorization`.
- **Vercel AI SDK Integration:** Maintained compatibility with `@ai-sdk/openai-compatible` for drop-in usage as a Vercel AI SDK Provider.

### Changed

- **`audio.speech.create` Return Signature:** Now strictly adheres to the OpenAPI specification, returning a JSON response containing `{ url, _devup }` instead of a raw `ArrayBuffer` stream.
- **`safeFetch` Headers Forwarding:** Configured custom headers in `RequestOptions` and the class constructor are now safely merged into every request payload.
- **`DevupAPIError` Class:** Uses `Object.setPrototypeOf(this, new.target.prototype)` to guarantee correct ESM/CJS prototype chain and `instanceof` behavior. Now properly extracts and preserves `type`, `code`, `requestId`, and `retryAfter` properties.
- **Package Build:** Disabled sourcemaps (`sourcemap: false`) in `tsup.config.ts` per security review and optimization constraints.

### Removed

- **`reranking.create` Resource:** The standalone reranking resource has been removed, as the `devup-rerank` models are served through the native inference proxy. Users should migrate to `client.inference.run()`.
- **Unsupported Request Formats:** Cleaned up several undocumented body fields on `audio.transcriptions`.
