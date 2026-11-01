# Migrating from 3.x to 4.0.0

`devupai` 4.0.0 is a major release. This guide lists every change that can
break code written for 3.x, with before and after code. The full list of
changes is in [CHANGELOG.md](./CHANGELOG.md).

Model ids below are placeholders such as `"<model-id>"`; list the models
available to your key with `client.models.list()`.

## Contents

1. [Node.js 22.12 or later](#1-nodejs-2212-or-later)
2. [One stream chunk type](#2-one-stream-chunk-type)
3. [Errors inside a stream throw](#3-errors-inside-a-stream-throw)
4. [`images.download(url)`](#4-imagesdownloadurl)
5. [`ModelObject.owned_by` is a string](#5-modelobjectowned_by-is-a-string)
6. [Optional `DevUpBilling` fields](#6-optional-devupbilling-fields)
7. [`TokenUsage` fields removed](#7-tokenusage-fields-removed)
8. [Embeddings: `number[] | string`](#8-embeddings-number--string)
9. [`APIPromise` and `withResponse()`](#9-apipromise-and-withresponse)
10. [Error subclasses, timeouts, and aborts](#10-error-subclasses-timeouts-and-aborts)
11. [Default retries and timeout](#11-default-retries-and-timeout)
12. [`models.list()` sends the API key](#12-modelslist-sends-the-api-key)
13. [Request options as a second argument](#13-request-options-as-a-second-argument)
14. [The `devupai/ai` integration](#14-the-devupaiai-integration)
15. [`message.content` can be `null`](#15-messagecontent-can-be-null)
16. [Other behaviour changes](#16-other-behaviour-changes)

---

## 1. Node.js 22.12 or later

`engines.node` is now `>=22.12.0`. Upgrade Node.js before you upgrade the
package.

```jsonc
// Before (3.x)
"engines": { "node": ">=18.0.0" }

// After (4.0.0)
"engines": { "node": ">=22.12.0" }
```

## 2. One stream chunk type

`ChatCompletionChunk` is now one type. `ChatCompletionBillingChunk` is removed,
so `"_devup" in chunk` no longer narrows and `chunk._devup.cost_dzd` no longer
compiles. Token usage arrives on the last chunk of a completed reply, which has
an empty `choices` array and carries `usage`. Request it with
`stream_options: { include_usage: true }`.

```typescript
// Before (3.x)
const stream = await client.chat.completions.create({
  model: "<model-id>",
  messages: [{ role: "user", content: "Hello." }],
  stream: true,
});

for await (const chunk of stream) {
  if ("_devup" in chunk) {
    console.log("Cost:", chunk._devup.cost_dzd, "DZD");
    continue;
  }
  process.stdout.write(chunk.choices?.[0]?.delta?.content ?? "");
}
```

```typescript
// After (4.0.0)
const stream = await client.chat.completions.create({
  model: "<model-id>",
  messages: [{ role: "user", content: "Hello." }],
  stream: true,
  stream_options: { include_usage: true },
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");

  if (chunk.usage) {
    console.log("\nTotal tokens:", chunk.usage.total_tokens);
  }
}

console.log("Request ID:", stream.requestId);
```

`ChatCompletionDeltaChunk` remains as a deprecated alias of
`ChatCompletionChunk`; replace it with `ChatCompletionChunk`.

```typescript
// Before (3.x)
import type { ChatCompletionDeltaChunk, ChatCompletionBillingChunk } from "devupai";

// After (4.0.0)
import type { ChatCompletionChunk } from "devupai";
```

## 3. Errors inside a stream throw

When the API reports an error after a stream has started, 3.x yielded it as a
chunk. 4.0.0 throws a `DevupAPIError` from the `for await` loop, with the
error's `code` and the stream's `requestId`. This applies to chat completions
and to Responses streams.

```typescript
// Before (3.x)
for await (const chunk of stream) {
  if ("error" in chunk) {
    console.error("Stream error:", chunk);
    break;
  }
  process.stdout.write(chunk.choices?.[0]?.delta?.content ?? "");
}
```

```typescript
// After (4.0.0)
import { DevupAPIError } from "devupai";

try {
  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
  }
} catch (error) {
  if (error instanceof DevupAPIError) {
    console.error("Stream error:", error.code, error.message, error.requestId);
  } else {
    throw error;
  }
}
```

A stream event that cannot be parsed is skipped and reported to the client's
`onDebug` option as a `malformed_frame` event.

## 4. `images.download(url)`

3.x `images.proxy({ url })` → 4.0.0 `images.download(url)`. The method is
renamed, with no alias, and takes the URL string itself (for example a
`data[].url` value) instead of an object. It fetches a generated image or video
file from the URL returned by the API and returns the native `Response`.

It accepts only URLs on the API's own origin (the origin of `baseURL`). Any
other URL, and any URL that contains a user name or password, throws a
`DevupAPIError` with code `invalid_url` and the message
"images.download only fetches URLs returned by the API." before a request is
sent. It never sends the API key. To download a file from any other URL, use
`fetch` directly.

```typescript
// Before (3.x)
const response = await client.images.proxy({ url: imageUrl });
```

```typescript
// After (4.0.0)
const generated = await client.images.generate({
  model: "<image-model-id>",
  prompt: "A lighthouse on the Mediterranean coast",
});

const url = generated.data[0]?.url;
if (url) {
  const response = await client.images.download(url);
  const bytes = await response.arrayBuffer();
  console.log(response.headers.get("content-type"), bytes.byteLength);
}
```

## 5. `ModelObject.owned_by` is a string

`owned_by` was typed as the literal `"devupai"`. It is now `string`: the
model's creator or organization, the part of `id` before its first `/`.

```typescript
// Before (3.x): owned_by was typed "devupai"
const owner: "devupai" = model.owned_by;
```

```typescript
// After (4.0.0)
const owner: string = model.owned_by;
```

`ModelObject` now also carries the other fields of `GET /v1/models`, such as
`name`, `type`, `pricing`, and `supports`.

## 6. Optional `DevUpBilling` fields

`DevUpBilling.cost_dzd` and `balance_dzd` are optional, and `_devup` is
optional on the responses where it can be absent. Under `strict` TypeScript,
read them with optional chaining.

```typescript
// Before (3.x)
const cost: number = response._devup.cost_dzd;
```

```typescript
// After (4.0.0)
const cost: number | undefined = response._devup?.cost_dzd;
if (cost !== undefined) {
  console.log("Cost:", cost, "DZD");
}
```

`DevUpBilling` also gains `request_id` and `warnings`.

## 7. `TokenUsage` fields removed

The top-level `reasoning_tokens` field is removed. The reasoning token count is
in `completion_tokens_details.reasoning_tokens`, when the model returns it.
`prompt_tokens_details` keeps `cached_tokens` only.

```typescript
// Before (3.x)
const reasoningTokens = response.usage?.reasoning_tokens;
```

```typescript
// After (4.0.0)
const reasoningTokens = response.usage?.completion_tokens_details?.reasoning_tokens;
```

## 8. Embeddings: `number[] | string`

`data[].embedding` is `number[] | string`. It is a base64 string when the
request sets `encoding_format: "base64"`, and an array of numbers otherwise.

```typescript
// Before (3.x)
const result = await client.embeddings.create({ model: "<embedding-model-id>", input: "Hello." });
const vector: number[] = result.data[0].embedding;
```

```typescript
// After (4.0.0)
const result = await client.embeddings.create({ model: "<embedding-model-id>", input: "Hello." });
const embedding = result.data[0]?.embedding;
if (Array.isArray(embedding)) {
  const vector: number[] = embedding;
  console.log("Dimensions:", vector.length);
}
```

## 9. `APIPromise` and `withResponse()`

Every API method now returns an `APIPromise<T>`, a `Promise` subclass. Code that
awaits the result, or types it as `Promise<T>`, keeps working. The new
`.withResponse()` method also returns the HTTP response, the request ID, and
the notices.

```typescript
// Before (3.x): only the parsed body was available.
const completion = await client.chat.completions.create({
  model: "<model-id>",
  messages: [{ role: "user", content: "Hello." }],
});
```

```typescript
// After (4.0.0)
const { data: completion, response, requestId, warnings } = await client.chat.completions
  .create({
    model: "<model-id>",
    messages: [{ role: "user", content: "Hello." }],
  })
  .withResponse();

console.log(response.status, requestId, warnings);
```

`warnings` contains informational notices about how the request was handled, read
from the `X-DEVUP-Warnings` header. Streams expose the same data as
`stream.response`, `stream.requestId`, and `stream.warnings`.

## 10. Error subclasses, timeouts, and aborts

API errors are now thrown as subclasses of `DevupAPIError`. Every subclass
extends `DevupAPIError`, so `instanceof DevupAPIError` checks keep working.

| Class                   | Status     |
| ----------------------- | ---------- |
| `AuthenticationError`   | 401        |
| `PermissionDeniedError` | 403        |
| `NotFoundError`         | 404        |
| `ConflictError`         | 409        |
| `RateLimitError`        | 429        |
| `InternalServerError`   | 500 and up |
| `APIConnectionError`    | `0`        |
| `APITimeoutError`       | `0`        |

`DevupAPIError` gains `param`, `retryAfterMs`, and `warnings`.

A timeout now throws `APITimeoutError` (a subclass of `APIConnectionError`)
instead of a raw `AbortError`. When you abort a call with your own `signal`,
the call rejects with the signal's reason, and a signal that is already
aborted rejects the call before a request is sent.

```typescript
// Before (3.x)
try {
  await client.chat.completions.create({ model: "<model-id>", messages, timeout: 30_000 });
} catch (error) {
  if (error instanceof Error && error.name === "AbortError") {
    console.error("Timed out");
  }
}
```

```typescript
// After (4.0.0)
import { APITimeoutError, RateLimitError } from "devupai";

try {
  await client.chat.completions.create({ model: "<model-id>", messages }, { timeout: 30_000 });
} catch (error) {
  if (error instanceof APITimeoutError) {
    console.error("Timed out");
  } else if (error instanceof RateLimitError) {
    console.error("Suggested wait (ms):", error.retryAfterMs);
  } else {
    throw error;
  }
}
```

## 11. Default retries and timeout

Transient errors (429, 502, 503, 504, network) are retried with backoff; set `maxRetries` to change it.

The default `timeout` is 600000 ms (10 minutes) per call. 3.x had no retries
and no default timeout.

```typescript
// Before (3.x): one attempt, no default timeout.
import DevupAI from "devupai";

const client = new DevupAI({ apiKey: process.env.DEVUP_API_KEY! });
```

```typescript
// After (4.0.0): keep the 3.x single attempt and choose your own timeout.
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
  maxRetries: 0,
  timeout: 20 * 60 * 1000,
});
```

For streams, `timeout` (on the client or per call) covers only the time until
the response headers arrive. To bound the time a stream may go without data,
use the new `streamIdleTimeout` option: it stops a stream when no data arrives
for that many milliseconds (off by default).

In 3.x, `timeout` was a per-call option only, and `timeout: 0` meant "no
timeout". In 4.0.0, `timeout: 0` throws a `TypeError`. For a very long limit,
set a large value instead; values above `2147483647` ms (about 24.8 days) are
treated as `2147483647`.

```typescript
// Before (3.x): a per-call timeout of 0 meant no timeout.
await client.chat.completions.create({ model: "<model-id>", messages, timeout: 0 });
```

```typescript
// After (4.0.0)
await client.chat.completions.create({ model: "<model-id>", messages }, { timeout: 2_147_483_647 });
```

Invalid client options throw a `TypeError` from the constructor; invalid
per-call options reject the call with a `TypeError` before a request is sent.
`maxRetries` must be a non-negative
integer, `timeout` must be a positive number of milliseconds, and
`streamIdleTimeout` must be a non-negative number of milliseconds (`0` turns
it off).

## 12. `models.list()` sends the API key

`models.list()` now sends `Authorization: Bearer <apiKey>`, like
`models.retrieve(id)`. If you added your own key header to make it work in
3.x, remove it.

```typescript
// Before (3.x)
const models = await client.models.list({
  headers: { "x-api-key": process.env.DEVUP_API_KEY! },
});
```

```typescript
// After (4.0.0)
const models = await client.models.list();
const model = await client.models.retrieve("<model-id>");
```

`health.check()` and `images.download()` send no key.

## 13. Request options as a second argument

Every method takes request options (`signal`, `timeout`, `maxRetries`,
`headers`, `streamIdleTimeout`) as its last argument. Passing them inside the
request parameters, as in 3.x, still works; when both are given, the second
argument takes precedence.

```typescript
// Before (3.x)
await client.chat.completions.create({
  model: "<model-id>",
  messages,
  timeout: 30_000,
});
```

```typescript
// After (4.0.0)
await client.chat.completions.create(
  { model: "<model-id>", messages },
  { timeout: 30_000 },
);
```

The client is also available as a named export:

```typescript
import { DevupAI } from "devupai";
```

The client options type is now `ClientOptions`. The 3.x name `DevUpAIOptions`
remains as a deprecated alias of `ClientOptions`.

```typescript
// Before (3.x)
import type { DevUpAIOptions } from "devupai";

// After (4.0.0)
import type { ClientOptions } from "devupai";
```

## 14. The `devupai/ai` integration

`devupai/ai` is rewritten for the Vercel AI SDK 7.

- **Peers:** `ai` 7, `@ai-sdk/openai-compatible` `>=3 <4`, and
  `@ai-sdk/provider` `>=4 <5`. Install both `@ai-sdk/*` packages: the
  integration uses both at runtime.
- **ESM-only:** the `require` entry is removed. Use `import`.
- **V4 model types:** the factories return `LanguageModelV4`,
  `EmbeddingModelV4`, and `ImageModelV4`.
- **Removed:** `completionModel` and `textEmbeddingModel` (use
  `embeddingModel`). `imageModel` generates images from text only and rejects
  input images and masks; use `client.images.edit()` from the core SDK for
  edits.
- **API key:** read from `apiKey`, else `DEVUP_API_KEY`, then `DEVUPAI_API_KEY`,
  when a request is made. With no key, the request throws `LoadAPIKeyError`.
  An `Authorization` entry in `headers` is ignored.
- **New settings:** `fetch`, and `models` (model data from `GET /v1/models`; a
  model whose `supports.structured_output` is `true` gets `json_schema`
  structured output).
- **Usage:** `streamText` now reports `usage`.
- **Type names:** `DevupAIIntegration` and `DevupAIIntegrationSettings`. The
  3.x names `DevupAIProvider` and `DevupAIProviderSettings` remain as
  deprecated aliases.

```bash
# Before (3.x)
npm install devupai ai@6 @ai-sdk/openai-compatible@2 @ai-sdk/provider@3

# After (4.0.0)
npm install devupai ai @ai-sdk/openai-compatible @ai-sdk/provider
```

```typescript
// Before (3.x): CommonJS worked, and completionModel existed.
const { createDevupAI } = require("devupai/ai");
const devupai = createDevupAI({ apiKey: process.env.DEVUP_API_KEY });
const model = devupai.completionModel("<model-id>");
const embedder = devupai.textEmbeddingModel("<embedding-model-id>");
```

```typescript
// After (4.0.0): ESM only.
import { generateText, embed } from "ai";
import DevupAI from "devupai";
import { createDevupAI, type DevupAIIntegrationSettings } from "devupai/ai";

const apiKey = process.env.DEVUP_API_KEY!;
const { data: models } = await new DevupAI({ apiKey }).models.list();

const settings: DevupAIIntegrationSettings = { apiKey, models };
const devupai = createDevupAI(settings);

const { text, usage } = await generateText({
  model: devupai("<model-id>"),
  prompt: "Hello.",
});
console.log(text, usage.totalTokens);

const { embedding } = await embed({
  model: devupai.embeddingModel("<embedding-model-id>"),
  value: "Hello.",
});
console.log(embedding.length);
```

## 15. `message.content` can be `null`

`message.content` can be `null` (for example on replies with tool calls);
check it before use. It can also be an array of content parts.

```typescript
// Before (3.x): content was assumed to be a string.
const completion = await client.chat.completions.create({ model: "<model-id>", messages });
const text = completion.choices[0]?.message?.content as string;
console.log(text.length);
```

```typescript
// After (4.0.0)
const completion = await client.chat.completions.create({ model: "<model-id>", messages });
const message = completion.choices[0]?.message;

if (typeof message?.content === "string") {
  console.log(message.content.length);
} else if (message?.tool_calls) {
  console.log("Tool calls:", message.tool_calls.length);
}
```

## 16. Other behaviour changes

- **Empty error body:** an error response with an empty body now has the
  message `HTTP <status>` (for example `HTTP 503`). 3.x used the HTTP status
  text.
- **Invalid JSON body:** a successful response whose body is not valid JSON now
  throws a `DevupAPIError` with the message "The response body is not valid
  JSON." 3.x threw a `SyntaxError`.
- **Network error in a stream:** a network error in the middle of a stream is
  thrown from the `for await` loop as an `APIConnectionError`, so
  `instanceof DevupAPIError` catches it.

  ```typescript
  // Before (3.x)
  try {
    for await (const chunk of stream) {
      process.stdout.write(chunk.choices?.[0]?.delta?.content ?? "");
    }
  } catch (error) {
    if (error instanceof TypeError) console.error("Connection lost");
  }
  ```

  ```typescript
  // After (4.0.0)
  import { APIConnectionError } from "devupai";

  try {
    for await (const chunk of stream) {
      process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
    }
  } catch (error) {
    if (error instanceof APIConnectionError) {
      console.error("Connection lost:", error.message, error.requestId);
    } else {
      throw error;
    }
  }
  ```

- **Header values:** an `apiKey` that contains a line break or a NUL character
  makes the constructor throw a `TypeError`. A header value (client `headers`
  or per-call `headers`) with such a character rejects the call with a
  `TypeError` that names the header, before a request is sent. Neither message
  contains the value.
- **Read-only properties:** the `DevupAI` resource properties (`chat`,
  `responses`, `models`, `images`, `embeddings`, `rerank`, `audio`, `video`,
  `inference`, `balance`, `health`, `webhooks`) and `baseURL` are `readonly`.
  Code that assigns to them no longer compiles.
- **Stream timeouts:** for streams, the per-call `timeout` covers only the time
  until the response headers arrive. Use `streamIdleTimeout` to bound the time a
  stream may go without data (see [section 11](#11-default-retries-and-timeout)).
