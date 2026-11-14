# Changelog

All notable changes to the `devupai` package are listed here. Earlier 3.x
entries are in [docs/v3/CHANGELOG_V3.md](https://github.com/devupai-platform/devupai-node/blob/main/docs/v3/CHANGELOG_V3.md).

## [4.1.0]

No breaking changes.

### Added

- `client.images.edit()` accepts a JSON form (`ImageEditJsonParams`): every
  input image is an `https://` URL or a `data:` URI, as a string or as
  `{ image_url }`. Several images are allowed in both forms (`images` or
  `image`; the first is the one a `mask` or `markup` applies to), and `markup`
  is a new optional input. The SDK sends JSON when no input is a file and
  `multipart/form-data` when any input is a file.
- Video generation with files: `client.video.generations.create()` sends
  `multipart/form-data` when any of `image`, `last_frame_image`,
  `reference_images`, `reference_videos`, or `reference_audios` is a file
  (`VideoGenerationCreateFormParams`); with strings only it sends JSON as
  before. New types `VideoGenerationFormRequest`, `VideoFrameImage`,
  `VideoReferenceImage`, `VideoReferenceVideo`, `VideoReferenceAudio`,
  `VideoReferenceVoiceAudio`, `VideoMediaInput`, and
  `VideoGenerationCreateFormParams`.
- `client.me.retrieve()` for `GET /v1/me` and `client.me.avatar()` for the
  account picture, with an `ifNoneMatch` option. Types `AccountProfile` and
  `AccountAvatar`.
- `client.inference.run()` accepts a `FormData` payload, sent as
  `multipart/form-data`, and the request option `responseType: "binary"`,
  which resolves to the native `Response` with its body unread.
- Transcriptions: `prompt`, `temperature`, and `timestamp_granularities`.
- `clientRequestId` (the `x-client-request-id` header) on `withResponse()`,
  on streams, and on `DevupAPIError`.
- `ifNoneMatch` on `client.models.list()` and `client.models.retrieve(id)`:
  the call resolves to `null` when the API answers 304 Not Modified, and
  `withResponse()` gives the 304 response and its `ETag`.
- Request and response types regenerated from the current API description:
  image options, `/v1/images/edits`, video options, frames, and reference
  media.

### Fixed

- `images.edit()` posts to `POST /v1/images/edits`, the endpoint the API
  documents for edits, and sends every field its type allows. The request and
  response shapes are unchanged.
- The README examples for Next.js use the current `ai` 7 helpers.
- The retry sentence lists 408.
- The links to the migration guide and the 3.x changelog work on npmjs.com.

## [4.0.0]

A major release. Upgrade steps, with before and after code, are in
[MIGRATION_V3_TO_V4.md](https://github.com/devupai-platform/devupai-node/blob/main/MIGRATION_V3_TO_V4.md).

### Breaking changes

- **Node.js 22.12.0 or later** (`engines.node` is `>=22.12.0`).
- **`devupai/ai` is rewritten for the Vercel AI SDK 7.** The peers are now
  `@ai-sdk/openai-compatible` `>=3 <4` and `@ai-sdk/provider` `>=4 <5`, both
  optional, and both are needed to use the integration. The integration is
  ESM-only (no `require` entry) and returns V4 model types (`LanguageModelV4`,
  `EmbeddingModelV4`, `ImageModelV4`). `completionModel` and
  `textEmbeddingModel` are removed (use `embeddingModel`); `imageModel` rejects
  input images and masks. A missing API key throws `LoadAPIKeyError` when a
  request is made. The settings type is `DevupAIIntegrationSettings` and the
  integration type `DevupAIIntegration`; the 3.x type names remain as
  deprecated aliases.
- **`ChatCompletionChunk` is one type.** `ChatCompletionBillingChunk` is
  removed, so `"_devup" in chunk` no longer narrows. The last chunk of a
  completed reply has an empty `choices` array and carries `usage`.
  `ChatCompletionDeltaChunk` remains as a deprecated alias of
  `ChatCompletionChunk`.
- **An error reported inside a stream throws.** Chat completion and Responses
  streams throw a `DevupAPIError` (with the error's `code` and the stream's
  `requestId`) instead of yielding the error as a chunk.
- **`images.proxy` renamed to `images.download(url)`**, with no alias. It takes
  the URL string itself (for example a `data[].url` value) instead of
  `{ url }`, and fetches a generated image or video file from the URL returned
  by the API. It accepts only URLs on the API's own origin, without a user name
  or password, and throws a `DevupAPIError` with code `invalid_url` ("images.download
  only fetches URLs returned by the API.") for any other URL, before a request
  is sent. It returns the native `Response` and never sends the API key.
- **`ModelObject.owned_by`** is typed `string`.
- **`DevUpBilling`:** `cost_dzd` and `balance_dzd` are optional, and `_devup` is
  optional on the responses where it can be absent.
- **`TokenUsage`:** the top-level `reasoning_tokens` field is removed; read
  `completion_tokens_details.reasoning_tokens`. `prompt_tokens_details` keeps
  `cached_tokens` only.
- **Embeddings:** `data[].embedding` is `number[] | string` (a base64 string
  when the request sets `encoding_format: "base64"`).
- **Every method returns an `APIPromise<T>`**, a `Promise` subclass. Code that
  awaits the result is unchanged.
- **Default retries and timeout.** Transient errors (408, 429, 502, 503, 504, network) are retried with backoff; set `maxRetries` to change it.
  The default `timeout` is 600000 ms (10 minutes) per call.
- **Typed timeouts and aborts.** A timeout throws `APITimeoutError` instead of
  a raw `AbortError`. A call whose `signal` is already aborted rejects before a
  request is sent, with the signal's reason. `timeout: 0` throws a `TypeError`.
  For streams, `timeout` covers only the time until the response headers
  arrive; `streamIdleTimeout` bounds the time a stream may go without data.
- **Error messages and classes.** An error response with an empty body has the
  message `HTTP <status>`. A successful response whose body is not valid JSON
  throws a `DevupAPIError` ("The response body is not valid JSON."). A network
  error in the middle of a stream throws an `APIConnectionError`.
- **Header values.** An `apiKey` or a header value that contains a line break
  or a NUL character throws a `TypeError`, before a request is sent.
- **`DevupAI` resource properties are `readonly`.**

### Notes

- `message.content` can be `null` (for example on replies with tool calls);
  check it before use. Before and after code is in
  [MIGRATION_V3_TO_V4.md](https://github.com/devupai-platform/devupai-node/blob/main/MIGRATION_V3_TO_V4.md#15-messagecontent-can-be-null).

### Added

- `client.responses.create()` for `POST /v1/responses`, with JSON responses and
  `stream: true` (a typed `ResponseStreamEvent` union).
- `client.models.retrieve(id)`; ids that contain `/` are encoded by the SDK.
- `.withResponse()` on every call: `{ data, response, requestId, warnings }`.
  Streams expose `response`, `requestId`, and `warnings`.
- `warnings`: informational notices about how the request was handled, read
  from the `X-DEVUP-Warnings` header, on `withResponse()`, streams, and errors.
- Error subclasses: `AuthenticationError` (401), `PermissionDeniedError` (403),
  `NotFoundError` (404), `ConflictError` (409), `RateLimitError` (429),
  `InternalServerError` (500 and up), `APIConnectionError`, and
  `APITimeoutError`. All extend `DevupAPIError`, so existing
  `instanceof DevupAPIError` checks keep working.
- `DevupAPIError` gains `param`, `retryAfterMs`, and `warnings`.
- Client options `maxRetries`, `timeout`, `streamIdleTimeout`, `fetch`, and
  `onDebug`. Request options `maxRetries` and `streamIdleTimeout`.
- Request options can be passed as a second argument to every method. Passing
  them inside the request parameters, as in 3.x, still works.
- `stream_options` on chat completion requests, and typed `usage`,
  `service_tier`, and `system_fingerprint` on `ChatCompletionChunk`.
- Transcriptions: `_devup` and the `verbose_json` fields.
- `User-Agent: devupai-node/<version>` on every request.
- `DevupAI` is also available as a named export.
- `devupai/ai`: a `models` setting that takes model data from
  `GET /v1/models` and uses each model's `supports.structured_output` flag; a
  `fetch` setting; `streamText` reports `usage` (streaming requests send
  `stream_options: { include_usage: true }`); `User-Agent` on every request.
- Request and response types are generated from the DEVUP AI OpenAPI
  specification (`npm run sync:spec`, `npm run generate:types`,
  `npm run check:types`).

### Fixed

- `models.list()` sends the API key.
- `rerank.create()`: `return_documents` is optional.
- A stream event that cannot be parsed is skipped and reported to `onDebug`
  as a `malformed_frame` event.
- An already-aborted `signal` is honoured, and abort listeners are removed
  when a call ends.

### Removed

- `ChatCompletionBillingChunk`.
- `TokenUsage.reasoning_tokens` (top level).
- `completionModel`, `textEmbeddingModel`, and image edits in `devupai/ai`.
- The `generate:provenance` script.
