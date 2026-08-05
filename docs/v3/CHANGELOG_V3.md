# Changelog - DEVUP AI SDK V3

## [3.0.0] - Unreleased

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
