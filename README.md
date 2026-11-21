<p align="center">
  <a href="https://devupai.com">
    <img
      src="https://devupai.com/image/devu.png"
      alt="DEVUP AI"
      width="200"
    />
  </a>
</p>

<h1 align="center">DEVUP AI — Official Node.js SDK</h1>

<p align="center">
  <strong>Build with leading AI models. Pay in Algerian Dinar.</strong>
</p>

<p align="center">
  A TypeScript-first SDK for chat, Responses, images, embeddings, reranking, audio, video, and native inference
  through one OpenAI-compatible API.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/devupai">
    <img src="https://img.shields.io/npm/v/devupai?style=flat-square&label=npm" alt="npm version" />
  </a>
  <a href="https://github.com/devupai-platform/devupai-node/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/devupai?style=flat-square" alt="MIT License" />
  </a>
  <img src="https://img.shields.io/node/v/devupai?style=flat-square" alt="Node.js version" />
  <img src="https://img.shields.io/badge/TypeScript-Ready-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript Ready" />
  <img src="https://img.shields.io/badge/OpenAI-Compatible-412991?style=flat-square&logo=openai&logoColor=white" alt="OpenAI Compatible" />
  <a href="https://status.devupai.com/">
    <img src="https://img.shields.io/badge/API-Status-10B981?style=flat-square" alt="DEVUP AI Status" />
  </a>
</p>

<p align="center">
  <a href="https://docs.devupai.com/"><strong>Documentation</strong></a>
  ·
  <a href="https://devupai.com/dashboard"><strong>Dashboard</strong></a>
  ·
  <a href="https://devupai.com/dashboard/api-keys"><strong>API Keys</strong></a>
  ·
  <a href="https://devupai.com/models"><strong>Models</strong></a>
  ·
  <a href="https://status.devupai.com/"><strong>Status</strong></a>
  ·
  <a href="https://www.npmjs.com/package/devupai"><strong>npm</strong></a>
</p>

---

## Overview

`devupai` is the official Node.js and TypeScript SDK for
[DEVUP AI](https://devupai.com), an AI platform with an OpenAI-compatible API,
built for developers and businesses in Algeria.

It gives you one consistent interface for:

- Chat completions, with streaming and reasoning output
- The Responses API
- Image generation and editing
- Text embeddings and reranking
- Text-to-speech and transcription
- Video generation and editing
- Native inference for specialized models
- Model discovery, account profile and balance, and health checks
- Webhook signature verification
- The Vercel AI SDK, through the optional `devupai/ai` integration

> **Core client:** zero runtime dependencies, ESM and CommonJS.  
> **Vercel AI SDK integration:** the optional, ESM-only `devupai/ai` export.

Upgrading from 3.x? Read [MIGRATION_V3_TO_V4.md](https://github.com/devupai-platform/devupai-node/blob/main/MIGRATION_V3_TO_V4.md) and the [CHANGELOG](https://github.com/devupai-platform/devupai-node/blob/main/CHANGELOG.md).

## Contents

- [Why DEVUP AI](#why-devup-ai)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Capability Matrix](#capability-matrix)
- [Core SDK](#core-sdk)
  - [Chat Completions](#chat-completions)
  - [Streaming](#streaming)
  - [Reasoning Output](#reasoning-output)
  - [Responses API](#responses-api)
  - [Images](#images)
  - [Model Options](#model-options)
  - [Downloading Generated Files](#downloading-generated-files)
  - [Embeddings](#embeddings)
  - [Reranking](#reranking)
  - [Audio](#audio)
  - [Video](#video)
  - [Native Inference](#native-inference)
  - [Models, Balance, and Health](#models-balance-and-health)
  - [Webhooks](#webhooks)
- [Vercel AI SDK](#vercel-ai-sdk)
- [Configuration](#configuration)
- [Request Options](#request-options)
- [Request IDs, Headers, and Notices](#request-ids-headers-and-notices)
- [Retries](#retries)
- [Timeouts and Cancellation](#timeouts-and-cancellation)
- [Error Handling](#error-handling)
  - [Request Size Limits](#request-size-limits)
- [API Behaviour Since 4.1.0](#api-behaviour-since-410)
- [TypeScript](#typescript)
- [Runtime and Security](#runtime-and-security)
- [Models](#models)
- [Get an API Key](#get-an-api-key)
- [Resources](#resources)
- [License](#license)

---

## Why DEVUP AI

| Capability                     | What it gives you                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| **Billing in DZD**             | Track AI usage and costs directly in Algerian Dinar.                                     |
| **Local payment access**       | Top up with supported local payment methods such as Edahabia and CIB.                    |
| **OpenAI-compatible API**      | Use familiar request shapes and migration patterns.                                      |
| **Multimodal inference**       | Access text, images, embeddings, audio, video, and specialized models from one SDK.      |
| **TypeScript-first contracts** | Request and response types generated from the DEVUP AI OpenAPI specification.            |
| **Modern runtime support**     | Node.js 22 or later, built on the standard `fetch`, `AbortSignal`, and Web Crypto.       |
| **Vercel AI SDK integration**  | Use `generateText`, `streamText`, Next.js handlers, and UI streaming through `devupai/ai`. |
| **Operational visibility**     | Request IDs, response headers, models, account balance, health, and billing metadata.    |

---

## Requirements

- Node.js **22.0.0** or later.
- For `devupai/ai`: the peers `@ai-sdk/openai-compatible` 3 and `@ai-sdk/provider` 4. The integration requires `ai` 7 in your app and is ESM-only.

---

## Installation

### Core SDK

```bash
npm install devupai
```

### Core SDK + Vercel AI SDK

```bash
npm install devupai ai @ai-sdk/openai-compatible @ai-sdk/provider
```

---

## Quick Start

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function main() {
  const response = await client.chat.completions.create({
    model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
    messages: [
      {
        role: "system",
        content: "You are a concise technical assistant.",
      },
      {
        role: "user",
        content: "Explain artificial intelligence in one paragraph.",
      },
    ],
  });

  console.log(response.choices[0]?.message?.content);
  console.log("Cost:", response._devup?.cost_dzd, "DZD");
}

main().catch(console.error);
```

The client is both the default export and a named export:

```typescript
import { DevupAI } from "devupai";
```

The model ids in this README are examples. List the models available to your
key with [`client.models.list()`](#models-balance-and-health).

---

## Capability Matrix

| Capability           | SDK method                             | API key sent             |
| -------------------- | -------------------------------------- | ------------------------ |
| Chat completions     | `client.chat.completions.create()`     | Yes                      |
| Responses            | `client.responses.create()`            | Yes                      |
| Image generation     | `client.images.generate()`             | Yes                      |
| Image editing        | `client.images.edit()`                 | Yes                      |
| Generated files      | `client.images.download(url)`          | No                       |
| Embeddings           | `client.embeddings.create()`           | Yes                      |
| Reranking            | `client.rerank.create()`               | Yes                      |
| Text-to-speech       | `client.audio.speech.create()`         | Yes                      |
| Transcription        | `client.audio.transcriptions.create()` | Yes                      |
| Video generation     | `client.video.generations.create()`    | Yes                      |
| Video editing        | `client.video.edits.create()`          | Yes                      |
| Native inference     | `client.inference.run()`               | Yes                      |
| List models          | `client.models.list()`                 | Yes                      |
| Retrieve a model     | `client.models.retrieve(id)`           | Yes                      |
| Account balance      | `client.balance.retrieve()`            | Yes                      |
| Account profile      | `client.me.retrieve()`                 | Yes                      |
| Account picture      | `client.me.avatar()`                   | Yes                      |
| Service health       | `client.health.check()`                | No                       |
| Webhook verification | `client.webhooks.verifySignature()`    | None (local computation) |
| Webhook construction | `client.webhooks.constructEvent()`     | None (local computation) |

Every API method returns an [`APIPromise`](#request-ids-headers-and-notices):
`await` it for the data, or call `.withResponse()` for the data together with
the HTTP response, the request ID, and notices.

---

# Core SDK

## Chat Completions

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function generateResponse() {
  const response = await client.chat.completions.create({
    model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
    messages: [
      {
        role: "user",
        content: "What is retrieval-augmented generation?",
      },
    ],
    temperature: 0.4,
    max_tokens: 800,
  });

  console.log(response.choices[0]?.message?.content);
  console.log("Tokens:", response.usage?.total_tokens);
  console.log("Cost:", response._devup?.cost_dzd, "DZD");
  console.log("Balance:", response._devup?.balance_dzd, "DZD");
}

generateResponse().catch(console.error);
```

## Streaming

Set `stream: true` to receive the reply as it is generated. The call resolves
to a `Stream<ChatCompletionChunk>` that you read with `for await`.

- Every chunk is a `ChatCompletionChunk` with the same `id`.
- When the model completes its reply, the **last chunk** has an empty
  `choices` array and carries `usage`. The API adds this chunk to every chat
  completion stream, with or without `stream_options: { include_usage: true }`.
- Chunks also carry the standard `service_tier` and `system_fingerprint`
  fields when the API returns them.
- The stream exposes `stream.response`, `stream.requestId`, and
  `stream.warnings` before you read the first chunk.
- `stream.clientRequestId` is the `x-client-request-id` response header, or
  `null` when the response has none.

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function streamResponse() {
  const stream = await client.chat.completions.create({
    model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
    messages: [
      {
        role: "user",
        content: "Write a short poem about Algeria.",
      },
    ],
    stream: true,
    stream_options: { include_usage: true },
  });

  console.log("Request ID:", stream.requestId);

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content ?? "");

    if (chunk.usage) {
      console.log("\nPrompt tokens:", chunk.usage.prompt_tokens);
      console.log("Completion tokens:", chunk.usage.completion_tokens);
      console.log("Total tokens:", chunk.usage.total_tokens);
    }
  }
}

streamResponse().catch(console.error);
```

Breaking out of the loop, or calling `stream.abort()`, closes the connection.

If the API reports an error after the stream has started, the loop throws a
[`DevupAPIError`](#error-handling) carrying the error's `code` and the stream's
`requestId`.

---

## Reasoning Output

Reasoning models can return their reasoning text in `reasoning_content` on the
message (and on `delta` when streaming). When the model returns it,
`usage.completion_tokens_details.reasoning_tokens` counts the reasoning tokens,
which are included in `completion_tokens`.

Set `max_tokens` high enough for both the reasoning and the answer, and check
`finish_reason`.

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function runReasoning() {
  const response = await client.chat.completions.create({
    model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
    messages: [
      {
        role: "user",
        content: "Is 3571 a prime number? Explain briefly.",
      },
    ],
    max_tokens: 2048,
  });

  const choice = response.choices[0];
  if (!choice) return;

  if (choice.finish_reason === "length") {
    console.warn("The reply reached max_tokens before it was complete.");
  }

  if (choice.message?.reasoning_content) {
    console.log("Reasoning:\n", choice.message.reasoning_content);
  }

  console.log("Answer:\n", choice.message?.content);

  const reasoningTokens = response.usage?.completion_tokens_details?.reasoning_tokens;
  if (reasoningTokens !== undefined) {
    console.log("Reasoning tokens:", reasoningTokens);
  }
}

runReasoning().catch(console.error);
```

---

## Responses API

`client.responses.create()` calls `POST /v1/responses`, the OpenAI-compatible
Responses API. The request body can be up to 10,485,760 bytes (10 MiB); see
[Request Size Limits](#request-size-limits).

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function createResponse() {
  const response = await client.responses.create({
    model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
    instructions: "Answer in two sentences.",
    input: "Describe the Sahara.",
    max_output_tokens: 300,
  });

  console.log("Status:", response.status);
  console.log("Output:", JSON.stringify(response.output, null, 2));
  console.log("Tokens:", response.usage?.total_tokens);
  console.log("Cost:", response._devup?.cost_dzd, "DZD");
}

createResponse().catch(console.error);
```

With `stream: true`, the call resolves to a `Stream<ResponseStreamEvent>`.
Each event has a `type`, such as `response.output_text.delta` or
`response.completed`. Skip any event type your code does not handle. An
`error` event makes the loop throw a [`DevupAPIError`](#error-handling).

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function streamResponse() {
  const stream = await client.responses.create({
    model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
    input: "Write a haiku about the sea.",
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      process.stdout.write(event.delta ?? "");
    } else if (event.type === "response.completed") {
      console.log("\nTokens:", event.response?.usage?.total_tokens);
    }
  }
}

streamResponse().catch(console.error);
```

---

## Images

<details open>
<summary><strong>Generate an image</strong></summary>

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function generateImage() {
  const response = await client.images.generate({
    model: "black-forest-labs/FLUX-1-schnell",
    prompt: "A cinematic view of Algiers at sunset",
    size: "1024x1024",
  });

  console.log(response.data[0]?.url);
  console.log("Cost:", response._devup?.cost_dzd, "DZD");
}

generateImage().catch(console.error);
```

`size` takes the sizes the model lists. On this model it is a free size: any
width and height from 128 to 1920 pixels, default `1024x1024`. Every image
model lists its sizes and other options in `image_params`; see
[Model Options](#model-options).

</details>

<details>
<summary><strong>Edit an image</strong></summary>

`client.images.edit()` posts to `POST /v1/images/edits`. Each input image is
an `https://` URL or a `data:` URI (as a string or as `{ image_url }`), or a
file (`Blob`, `File`, or `Uint8Array`). Pass one input as `image`, or several
as an array; the first is the one an optional `mask` or `markup` applies to.
Every `images.generate()` field (`prompt`, `size`, `quality`,
`output_format`, ...) is accepted. The SDK sends JSON when no input is a file
(`ImageEditJsonParams`, where the array can also be named `images`) and
`multipart/form-data` when any input is a file (`ImageEditParams`). Replace
`<image-edit-model-id>` with a model that supports image edits; see the
[model catalog](https://devupai.com/models).

With image URLs:

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function editImageFromUrl() {
  const response = await client.images.edit({
    model: "<image-edit-model-id>",
    image: "https://example.com/street.png",
    prompt: "Add a red sports car in the foreground",
  });

  console.log(response.data[0]?.url);
  console.log("Cost:", response._devup?.cost_dzd, "DZD");
}

editImageFromUrl().catch(console.error);
```

With files:

```typescript
import { readFile } from "node:fs/promises";
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function editImageFromFiles() {
  const image = new Blob([await readFile("input.png")], {
    type: "image/png",
  });
  const mask = new Blob([await readFile("mask.png")], {
    type: "image/png",
  });

  const response = await client.images.edit({
    model: "<image-edit-model-id>",
    image,
    mask,
    prompt: "Replace the masked area with a garden",
  });

  console.log(response.data[0]?.url);
}

editImageFromFiles().catch(console.error);
```

Use the mask format the model lists in `image_params.inputs.mask_format`:
`alpha` (a PNG whose transparent areas mark the part to edit) or
`black_and_white` (white marks the part to edit, black the part to keep). See
[Model Options](#model-options).

</details>

## Model Options

Image models take different options. `client.models.list()` and
`client.models.retrieve(id)` return them in `image_params` (type
`ImageParams`) on each model that lists image options; the field is absent on
other models. Field names and values are the ones a request sends.

- `endpoints`: `generations`, `edits`, or both.
- `options` (`ImageParamsOption[]`): each option's request `field` and what it
  takes: `values`, `range`, `default`, `required`, `max_length`, and, for
  `size`, `free` (the free sizes, for example `min_edge` and `max_edge`). An
  option with a `kind` (`boolean`, `choice`, `int`, `decimal`, `text`, or
  `structured`) is an option of the model's own, sent under its own name.
- `inputs` (`ImageParamsInputs`): the input images an edit takes (`image.min`,
  `image.max`, and, when listed, `roles`, `max_pixels`, and `max_edge`),
  whether the model takes `mask` or `markup`, `mask_required` (every edit
  needs a mask), `mask_max_images`, and `mask_format` (`alpha` or
  `black_and_white`).
- `prompt`: `none` (the model takes no prompt), `optional`, or absent (a
  prompt is required). `prompt_max_length` is the longest prompt, counted in
  Unicode code points: an emoji counts as one.

`client.images.generate()` and `client.images.edit()` accept the options a
model lists without a type error: send an option of the model's own under its
`field` name (its value is typed `unknown`; `image_params` describes it). A `structured` value (a list or an object) is sent as a JSON value, and
as one JSON field in `multipart/form-data`.

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function generateWithModelOptions() {
  const model = await client.models.retrieve("Qwen/Qwen-Image-Edit-Max");
  const params = model.image_params;
  if (!params) return;

  console.log("Endpoints:", params.endpoints.join(", "));
  for (const option of params.options) {
    console.log(option.field, option.kind ?? "image option", {
      values: option.values,
      range: option.range,
      default: option.default,
      required: option.required ?? false,
    });
  }
  console.log("Prompt:", params.prompt ?? "required", params.prompt_max_length);
  console.log("Input images:", params.inputs?.image?.min, "to", params.inputs?.image?.max);
  console.log("Mask format:", params.inputs?.mask_format ?? "not listed");

  // prompt_extend is an option of this model's own (kind "boolean", default true).
  const response = await client.images.generate({
    model: "Qwen/Qwen-Image-Edit-Max",
    prompt: "A watercolor map of the Algerian coast",
    size: "1536x1024",
    negative_prompt: "text, watermark",
    prompt_extend: false,
  });

  console.log(response.data[0]?.url);
}

generateWithModelOptions().catch(console.error);
```

A value the model does not accept returns HTTP 400 `invalid_value`, and the
message names what the model accepts. An option the model marks as
`required`, left out, returns HTTP 400 `missing_required_parameter` before
anything is charged. Both are thrown as `BadRequestError`.

---

## Downloading Generated Files

`client.images.download(url)` fetches a generated image or video file from the
URL returned by the API (for example a `data[].url` value), and returns the
native `Response`, so you can read its headers and binary body.

- It accepts only URLs on the API's own origin (the origin of `baseURL`). Any
  other URL, and any URL that contains a user name or password, throws a
  `DevupAPIError` with code `invalid_url` and the message
  "images.download only fetches URLs returned by the API." before a request is
  sent.
- It does not send your API key.
- A link returned by the API expires after a short period. Downloading an
  expired link throws a `PermissionDeniedError` (HTTP 403): generate the image
  or video again to get a new link.

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function downloadImage() {
  const generated = await client.images.generate({
    model: "black-forest-labs/FLUX-1-schnell",
    prompt: "A lighthouse on the Mediterranean coast",
  });

  const url = generated.data[0]?.url;
  if (!url) return;

  const file = await client.images.download(url);
  console.log("Content-Type:", file.headers.get("content-type"));

  const bytes = await file.arrayBuffer();
  console.log("Image bytes:", bytes.byteLength);
}

downloadImage().catch(console.error);
```

---

## Embeddings

`embedding` is an array of numbers, or a base64 string when the request sets
`encoding_format: "base64"`. `input` takes up to 2,048 texts; a longer array
returns HTTP 400 `payload_too_large`. The request body can be up to
10,485,760 bytes (10 MiB); a larger body returns HTTP 413 `payload_too_large`
(`PayloadTooLargeError`) and is not charged.

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function createEmbeddings() {
  const response = await client.embeddings.create({
    model: "BAAI/bge-m3",
    input: ["Hello world", "مرحبا بالعالم", "Bonjour le monde"],
  });

  const vector = response.data[0]?.embedding;
  if (Array.isArray(vector)) {
    console.log("Dimensions:", vector.length);
  }
}

createEmbeddings().catch(console.error);
```

---

## Reranking

`return_documents` is optional. The request body can be up to 10,485,760
bytes (10 MiB); a larger body returns HTTP 413 `payload_too_large`
(`PayloadTooLargeError`) and is not charged.

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function rerankDocuments() {
  const response = await client.rerank.create({
    model: "Qwen/Qwen3-Reranker-8B",
    query: "What is DEVUP AI?",
    documents: [
      "DEVUP AI is an AI platform with an OpenAI-compatible API.",
      "Algiers is the capital of Algeria.",
    ],
    top_n: 1,
  });

  console.log(response.results);
}

rerankDocuments().catch(console.error);
```

---

## Audio

<details open>
<summary><strong>Text-to-speech</strong></summary>

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function createSpeech() {
  const response = await client.audio.speech.create({
    model: "hexgrad/Kokoro-82M",
    input: "Welcome to DEVUP AI.",
  });

  console.log("Audio URL:", response.url);
  console.log("Cost:", response._devup?.cost_dzd, "DZD");
}

createSpeech().catch(console.error);
```

</details>

<details>
<summary><strong>Speech-to-text</strong></summary>

`response_format` `json` and `verbose_json` return an object; `text`, `srt`, and
`vtt` return a string. The request also accepts `prompt`, `temperature`, and,
with `response_format: "verbose_json"`, `timestamp_granularities` (an array of
`"word"` and `"segment"`). The request body, the audio file included, can be
up to 10,485,760 bytes (10 MiB); a larger body returns HTTP 413
`payload_too_large` (`PayloadTooLargeError`) and is not charged.

```typescript
import { readFile } from "node:fs/promises";
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function transcribeAudio() {
  const audio = new Blob([await readFile("speech.wav")], {
    type: "audio/wav",
  });

  const transcript = await client.audio.transcriptions.create({
    file: audio,
    model: "openai/whisper-large-v3-turbo",
    language: "ar",
    response_format: "json",
  });

  console.log(transcript.text);
}

transcribeAudio().catch(console.error);
```

With `verbose_json`, request word or segment timestamps:

```typescript
import { readFile } from "node:fs/promises";
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function transcribeWithTimestamps() {
  const audio = new Blob([await readFile("speech.wav")], {
    type: "audio/wav",
  });

  const transcript = await client.audio.transcriptions.create({
    file: audio,
    model: "openai/whisper-large-v3-turbo",
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"],
    prompt: "DEVUP AI, Algiers",
    temperature: 0,
  });

  console.log(transcript.text);
}

transcribeWithTimestamps().catch(console.error);
```

</details>

---

## Video

<details open>
<summary><strong>Generate a video</strong></summary>

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function generateVideo() {
  const response = await client.video.generations.create({
    model: "Wan-AI/Wan2.2-T2V-A14B",
    prompt: "A camel walking through the Sahara at golden hour",
  });

  console.log(response.data[0]?.url);
  console.log("Cost:", response._devup?.cost_dzd, "DZD");
}

generateVideo().catch(console.error);
```

</details>

<details>
<summary><strong>Generate a video from frames or reference media</strong></summary>

With strings only (`VideoGenerationCreateParams`), the request is sent as JSON:
`image`, `last_frame_image`, and the `reference_*` fields take `https://` URLs
or `data:` URIs, as a string or as `{ image_url }`. When any of `image`,
`last_frame_image`, `reference_images`, `reference_videos`, or
`reference_audios` is a file (`Blob`, `File`, or `Uint8Array`), the request is
sent as `multipart/form-data` (`VideoGenerationCreateFormParams`; one input is
a `VideoMediaInput`). The three `reference_*` fields take one item or an array.
Replace `<image-to-video-model-id>` with a model that takes a first frame; see
the [model catalog](https://devupai.com/models).

```typescript
import { readFile } from "node:fs/promises";
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function generateVideoFromImage() {
  const firstFrame = new Blob([await readFile("first-frame.png")], {
    type: "image/png",
  });

  const response = await client.video.generations.create({
    model: "<image-to-video-model-id>",
    prompt: "The camera slowly pulls back from the harbour",
    image: firstFrame,
  });

  console.log(response.data[0]?.url);
}

generateVideoFromImage().catch(console.error);
```

The related types are exported: `VideoGenerationFormRequest`,
`VideoFrameImage`, `VideoReferenceImage`, `VideoReferenceVideo`,
`VideoReferenceAudio`, `VideoReferenceVoiceAudio`, `VideoMediaInput`, and
`VideoGenerationCreateFormParams`.

</details>

<details>
<summary><strong>Edit a video</strong></summary>

Replace `<video-edit-model-id>` with a model that supports video edits; see the
[model catalog](https://devupai.com/models).

```typescript
import { readFile } from "node:fs/promises";
import DevupAI, { type VideoKeyPoint } from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function editVideo() {
  const video = new Blob([await readFile("input.mp4")], {
    type: "video/mp4",
  });

  const keyPoints: VideoKeyPoint[] = [
    {
      x: 320,
      y: 240,
      type: "positive",
    },
  ];

  const response = await client.video.edits.create({
    model: "<video-edit-model-id>",
    video,
    prompt: "Enhance the subject while keeping the background",
    key_points: keyPoints,
  });

  console.log(response.data[0]?.url);
}

editVideo().catch(console.error);
```

</details>

---

## Native Inference

Native inference sends a payload in the model's own request format to
`POST /v1/inference/{model}`: a JSON object, or a `FormData` that is sent as
`multipart/form-data` as it is. The payload and the response shape depend on
the model. The response type defaults to `unknown`; provide a generic type when
your application knows the shape. For a model that answers with a file, pass
the request option `responseType: "binary"`: the call then resolves to the
native `Response` with its body unread. The default is `"json"`.

This endpoint serves models whose `type` (in `client.models.retrieve(id)`) is
`text-generation`, `reranker`, or `zero-shot-image-classification`. Image,
video, speech, transcription, and embeddings models use their own methods
above; on this endpoint they return HTTP 400 `invalid_route`, and the message
names the endpoint to use. Replace `<model-id>` with a model of one of these types.

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function runInference() {
  const result = await client.inference.run<Record<string, unknown>>(
    "<model-id>",
    { input: "Hello from Algeria!" },
  );

  console.log(Object.keys(result));
}

runInference().catch(console.error);
```

With a `FormData` payload, and with a binary answer:

```typescript
import { readFile } from "node:fs/promises";
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function runInferenceWithFiles() {
  const form = new FormData();
  form.append(
    "image",
    new Blob([await readFile("photo.jpg")], { type: "image/jpeg" }),
    "photo.jpg",
  );

  // multipart/form-data request, JSON answer.
  const result = await client.inference.run<Record<string, unknown>>("<model-id>", form);
  console.log(Object.keys(result));

  // A model that answers with a file: read the native Response.
  const file = await client.inference.run(
    "<model-id>",
    { input: "A lighthouse at night" },
    { responseType: "binary" },
  );
  console.log("Content-Type:", file.headers.get("content-type"));
  const bytes = await file.arrayBuffer();
  console.log("Bytes:", bytes.byteLength);
}

runInferenceWithFiles().catch(console.error);
```

Add a `webhook` URL to the payload to receive the result asynchronously; see
[Webhooks](#webhooks).

---

## Models, Balance, and Health

`models.list()` and `models.retrieve()` send your API key. `health.check()`
does not.

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function inspectAccount() {
  const health = await client.health.check();
  console.log("API status:", health.status);

  const models = await client.models.list();
  console.log("Available models:", models.data.length);

  const model = await client.models.retrieve("deepseek-ai/DeepSeek-V4.1-Flash-1017");
  console.log(model.id, model.type, model.supports.structured_output);

  const balance = await client.balance.retrieve();
  console.log("Balance:", balance.balance_dzd, "DZD");
}

inspectAccount().catch(console.error);
```

`models.retrieve(id)` accepts ids that contain `/`; the SDK encodes them.

Both model calls accept the request option `ifNoneMatch: "<etag>"`, sent as
`If-None-Match`. When the API answers 304 Not Modified, the call resolves to
`null` (the result type becomes `ModelListResponse | null` or
`ModelObject | null` for that call), and `withResponse()` gives the 304
response with its `ETag` header. An `If-None-Match` header given in `headers`
(client or request) gets the same result on a 304; only `ifNoneMatch` adds
`null` to the result type.

Image models also carry `image_params`, their image options; see
[Model Options](#model-options).

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function listModelsIfChanged() {
  const { data, response } = await client.models.list().withResponse();
  console.log(`${data.data.length} models`);

  const etag = response.headers.get("etag");
  if (etag) {
    const refreshed = await client.models.list({ ifNoneMatch: etag });
    console.log(refreshed === null ? "Not modified" : `${refreshed.data.length} models`);
  }
}

listModelsIfChanged().catch(console.error);
```

### Account profile

`client.me.retrieve()` calls `GET /v1/me` and returns an `AccountProfile`:
`display_name`, `initial`, `email_hint`, and `avatar` (an `AccountAvatar`,
`{ url, etag }`, or `null` when the account has no picture).
`client.me.avatar()` fetches the picture itself and resolves to the native
`Response` with its body unread; read `Content-Type` (`image/png`,
`image/jpeg`, or `image/webp`) and `ETag` from its headers. Pass
`ifNoneMatch: "<etag>"` to send `If-None-Match`; a 304 resolves with that
`Response` (status 304, empty body).

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function showProfile() {
  const profile = await client.me.retrieve();
  console.log(profile.display_name, profile.initial, profile.email_hint);

  if (profile.avatar) {
    const picture = await client.me.avatar();
    console.log("Content-Type:", picture.headers.get("content-type"));
    console.log("Bytes:", (await picture.arrayBuffer()).byteLength);

    const again = await client.me.avatar({ ifNoneMatch: profile.avatar.etag });
    console.log(again.status === 304 ? "Same picture" : "New picture");
  }
}

showProfile().catch(console.error);
```

---

## Webhooks

Verify incoming webhook deliveries and construct typed event payloads.

You can import the standalone helper functions directly or use them through `client.webhooks`.

### Verifying and Parsing Events (Express)

```typescript
import express from "express";
import {
  constructWebhookEvent,
  DevupWebhookVerificationError,
  type WebhookEvent,
} from "devupai";

const app = express();
const endpointSecret = process.env.DEVUP_WEBHOOK_SECRET!;

// express.raw() is required: express.json() parses and changes the body bytes, so verification cannot match
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["x-devup-signature"];
    if (typeof signature !== "string") {
      return res.status(400).send("Missing signature header");
    }

    try {
      const event: WebhookEvent = await constructWebhookEvent({
        rawBody: req.body,
        signatureHeader: signature,
        secret: endpointSecret,
      });

      if (event.status === "succeeded") {
        console.log("Inference succeeded:", event.id);
        console.log("Results:", event.results);
        console.log("Cost:", event.cost_dzd, "DZD");
      } else {
        console.error("Inference error:", event.id);
        console.error("Error:", event.error.type, event.error.message);
      }

      res.status(200).json({ received: true });
    } catch (err) {
      if (err instanceof DevupWebhookVerificationError) {
        console.error(`Webhook verification error (${err.reason}):`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
      res.status(500).send("Server Error");
    }
  }
);

app.listen(3000, () => console.log("Webhook receiver listening on port 3000"));
```

### Boolean Signature Verification

If you prefer a boolean result to an exception, use `verifyWebhookSignature`:

```typescript
import { verifyWebhookSignature } from "devupai";

async function handleWebhook(rawBody: string | Uint8Array, signatureHeader: string) {
  const isValid = await verifyWebhookSignature({
    rawBody,
    signatureHeader,
    secret: process.env.DEVUP_WEBHOOK_SECRET!,
    toleranceSeconds: 300,
  });

  if (!isValid) {
    console.warn("Rejected an unsigned or expired webhook delivery");
    return false;
  }

  const payload = JSON.parse(
    typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody)
  );
  return payload;
}
```

### Verification Error Reasons

When `constructWebhookEvent` cannot verify a delivery, it throws a `DevupWebhookVerificationError` with a specific `reason` field:

| Reason | When it applies | What to do |
| ------ | --------------- | ---------- |
| `malformed_header` | The `X-DevUp-Signature` header is missing, empty, lacks a valid `t=` timestamp, or contains no `v1=` signatures. | Make sure your web server passes the `X-DevUp-Signature` header through unchanged. |
| `timestamp_outside_tolerance` | The difference between the request timestamp `t` and local system time exceeds `toleranceSeconds` (default 300s). | This usually indicates server clock skew. Synchronize your server clock with NTP or increase `toleranceSeconds`. |
| `no_matching_signature` | None of the `v1` signatures in the header match the computed HMAC over the raw body and timestamp. | Confirm that `secret` matches your dashboard webhook secret, and that `rawBody` is the untouched raw body (not re-serialized JSON). |
| `invalid_json` | The signature matches, but the payload body is not valid JSON. | Make sure nothing between the sender and your handler changes or truncates the body. |

### Deduplication

The same delivery can arrive more than once. Key idempotency checks on the
`X-DevUp-Delivery-Id` header, which stays the same for every delivery of an
event. The `t=` timestamp and the signature change on each delivery, so do not
key idempotency on the signature.

After a webhook secret rotation, the signature header can carry several `v1`
signatures for a while (one per valid secret). Accepting any matching signature
lets you rotate secrets without downtime.

---

# Vercel AI SDK

`devupai/ai` connects DEVUP AI to the [Vercel AI SDK](https://ai-sdk.dev) 7.

- **ESM-only:** use `import`, not `require`.
- **Peers:** `@ai-sdk/openai-compatible` 3 and `@ai-sdk/provider` 4. The integration requires `ai` 7 in your app.
- **Node.js:** 22 or later.

```bash
npm install devupai ai @ai-sdk/openai-compatible @ai-sdk/provider
```

`createDevupAI()` takes `apiKey`, `baseURL`, `headers`, `fetch`, and `models`.
When `apiKey` is omitted, it reads `DEVUP_API_KEY` (then `DEVUPAI_API_KEY`)
from the environment when a request is made; with no key, the request throws
`LoadAPIKeyError`. An `Authorization` entry in `headers` is not sent: the key
always comes from `apiKey`. A default instance is exported as `devupai`.

| Model factory                                    | Use                                                |
| ------------------------------------------------ | -------------------------------------------------- |
| `devupai(id)`, `devupai.languageModel(id)`, `devupai.chatModel(id)` | Chat models for `generateText` and `streamText`.   |
| `devupai.embeddingModel(id)`                     | Embedding models for `embed` and `embedMany`.      |
| `devupai.imageModel(id)`                         | Text-to-image generation for `generateImage`.      |

The settings and model data types are exported as `DevupAIIntegrationSettings`
and `DevupAIModelData`, and the integration type as `DevupAIIntegration`.

Streaming requests send `stream_options: { include_usage: true }`, so `usage`
is available on `streamText` results.

Retries of calls made through `devupai/ai` follow the AI SDK's own
`maxRetries` setting (default 2), not the rule in [Retries](#retries). The AI
SDK can retry a 408, 502 or 504 answer of a billed call, which may already
have been processed and charged; pass `maxRetries: 0` to `generateText`,
`streamText`, `generateImage`, `embed` or `embedMany` to send each call once.

## Generate text

```typescript
import { generateText } from "ai";
import { createDevupAI } from "devupai/ai";

const devupai = createDevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function main() {
  const { text, usage } = await generateText({
    model: devupai("deepseek-ai/DeepSeek-V4.1-Flash-1017"),
    prompt: "Explain neural networks in simple terms.",
  });

  console.log(text);
  console.log("Tokens:", usage.totalTokens);
}

main().catch(console.error);
```

## Stream text

```typescript
import { streamText } from "ai";
import { createDevupAI } from "devupai/ai";

const devupai = createDevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function main() {
  const result = streamText({
    model: devupai("deepseek-ai/DeepSeek-V4.1-Flash-1017"),
    prompt: "Write a short story set in Algiers.",
  });

  for await (const text of result.textStream) {
    process.stdout.write(text);
  }

  console.log("\nTokens:", (await result.usage).totalTokens);
}

main().catch(console.error);
```

## Embeddings

```typescript
import { embed } from "ai";
import { createDevupAI } from "devupai/ai";

const devupai = createDevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function main() {
  const { embedding } = await embed({
    model: devupai.embeddingModel("BAAI/bge-m3"),
    value: "Sunny day at the beach",
  });

  console.log("Dimensions:", embedding.length);
}

main().catch(console.error);
```

`devupai.imageModel(id)` generates images from text. It rejects input images
and masks before any request; use `client.images.edit()` from the core SDK for
edits. The integration has no `completionModel`.

## Structured outputs from model data

Pass the model list from `GET /v1/models` as `models`. For each model whose
`supports.structured_output` is `true`, structured output requests then use a
`json_schema` response format. Without `models`, the adapter default applies.

```typescript
import DevupAI from "devupai";
import { createDevupAI } from "devupai/ai";

const apiKey = process.env.DEVUP_API_KEY!;
const client = new DevupAI({ apiKey });

const { data: models } = await client.models.list();
const devupai = createDevupAI({ apiKey, models });
```

## Next.js plain-text streaming

```typescript
import {
  convertToModelMessages,
  createTextStreamResponse,
  streamText,
  toTextStream,
  type UIMessage,
} from "ai";
import { createDevupAI } from "devupai/ai";

const devupai = createDevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

export async function POST(request: Request) {
  const body = (await request.json()) as { messages: UIMessage[] };

  const result = streamText({
    model: devupai("deepseek-ai/DeepSeek-V4.1-Flash-1017"),
    messages: await convertToModelMessages(body.messages),
  });

  return createTextStreamResponse({ stream: toTextStream({ stream: result.stream }) });
}
```

## Next.js UI streaming

```typescript
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { createDevupAI } from "devupai/ai";

const devupai = createDevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

export async function POST(request: Request) {
  const body = (await request.json()) as { messages: UIMessage[] };

  const result = streamText({
    model: devupai("deepseek-ai/DeepSeek-V4.1-Flash-1017"),
    messages: await convertToModelMessages(body.messages),
  });

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
```

---

# Configuration

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
  baseURL: "https://api.devupai.com/v1",
  headers: {
    "X-Application-Name": "my-application",
  },
  maxRetries: 2,
  timeout: 600_000,
});
```

| Option              | Type                           | Required | Default                      | Description                                                                               |
| ------------------- | ------------------------------ | -------: | ---------------------------- | ----------------------------------------------------------------------------------------- |
| `apiKey`            | `string`                       |      Yes | —                            | Your DEVUP AI API key.                                                                    |
| `baseURL`           | `string`                       |       No | `https://api.devupai.com/v1` | DEVUP AI API base URL. A trailing `/` is removed.                                         |
| `headers`           | `Record<string, string>`       |       No | —                            | Custom headers included in every request.                                                 |
| `maxRetries`        | `number`                       |       No | `2`                          | How many times a transient error is retried. See [Retries](#retries).                     |
| `timeout`           | `number`                       |       No | `600000` (10 minutes)        | Milliseconds per call. See [Timeouts](#timeouts-and-cancellation).                        |
| `streamIdleTimeout` | `number`                       |       No | Off                          | Milliseconds a stream may go without data before it stops with `APITimeoutError`.        |
| `fetch`             | `typeof fetch`                 |       No | `globalThis.fetch`           | A custom `fetch` implementation.                                                          |
| `onDebug`           | `(event: DebugEvent) => void`  |       No | —                            | Receives debug events: `retry` (before a retry) and `malformed_frame` (a stream event that could not be parsed and was skipped). |

The SDK sends `User-Agent: devupai-node/<version>`. It manages the
`Authorization` and `Content-Type` headers itself; custom headers cannot
override them.

---

# Request Options

Every method takes request options as its last argument.

| Option              | Type                     | Description                                                       |
| ------------------- | ------------------------ | ----------------------------------------------------------------- |
| `signal`            | `AbortSignal \| null`    | Cancel the request with an external abort signal.                 |
| `timeout`           | `number`                 | Milliseconds for this call, instead of the client `timeout`.      |
| `maxRetries`        | `number`                 | Retries for this call, instead of the client `maxRetries`.        |
| `headers`           | `Record<string, string>` | Extra headers for this request.                                   |
| `streamIdleTimeout` | `number`                 | Idle limit for this stream, instead of the client setting.        |
| `ifNoneMatch`       | `string`                 | Sends `If-None-Match` with this value (`models.list()`, `models.retrieve()`, `me.avatar()`). |
| `responseType`      | `"json" \| "binary"`     | `inference.run()` only: `"binary"` resolves to the native `Response`, body unread. |

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function requestWithOptions() {
  const response = await client.chat.completions.create(
    {
      model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
      messages: [
        {
          role: "user",
          content: "Summarize Algeria in three sentences.",
        },
      ],
    },
    {
      timeout: 30_000,
      maxRetries: 0,
      headers: {
        "X-Request-Source": "documentation-example",
      },
    },
  );

  console.log(response.choices[0]?.message?.content);
}

requestWithOptions().catch(console.error);
```

As in 3.x, the options can also be passed inside the request parameters.
When both are given, the second argument takes precedence.

---

# Request IDs, Headers, and Notices

Every API method returns an `APIPromise<T>`, a regular `Promise` with one extra
method: `.withResponse()`. It resolves to:

| Field       | Type             | Description                                                         |
| ----------- | ---------------- | ------------------------------------------------------------------- |
| `data`      | `T`              | The same value that `await` returns.                                |
| `response`  | `Response`       | The HTTP response, with its status and headers.                     |
| `requestId` | `string \| null` | The `x-request-id` header. Include it when you contact support.     |
| `clientRequestId` | `string \| null` | The `x-client-request-id` header.                             |
| `warnings`  | `string[]`       | Notice codes from the `X-DEVUP-Warnings` header (empty when none).  |

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function main() {
  const { data, requestId, warnings, response } = await client.chat.completions
    .create({
      model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
      messages: [{ role: "user", content: "Hello." }],
    })
    .withResponse();

  console.log(data.choices[0]?.message?.content);
  console.log("Request ID:", requestId);
  console.log("Status:", response.status);

  for (const notice of warnings) {
    console.info("Notice:", notice);
  }
}

main().catch(console.error);
```

Streams expose the same information directly: `stream.response`,
`stream.requestId`, `stream.clientRequestId`, and `stream.warnings`. Errors carry `requestId`,
`clientRequestId`, and `warnings` too.

`warnings` lists the notice codes of the `X-DEVUP-Warnings` response header,
split at the commas (for example `parameter_not_supported`). The header is
sent on streamed and non-streamed responses alike, and only when there is at
least one notice. On chat completions and Responses without streaming, on
video generation, and on image generation and edits with models that list
image options, the body also lists each notice's message in
`_devup.warnings`. The codes are stable: use
them in your code, not the message text. Notices are informational: the
request was answered.

---

# Retries

The `DevupAI` client retries a request up to `maxRetries` times (default 2).
Calls made through `devupai/ai` follow the AI SDK's retries instead (see
[Vercel AI SDK](#vercel-ai-sdk)). When the
answer has a `Retry-After` (or `retry-after-ms`) header, the SDK waits that
long before the next
attempt; otherwise it waits a random time that grows with each attempt, up to
60 seconds. A wait that does not fit in the remaining `timeout` ends the call
with the error. A 500 answer is not retried.

| Requests | Retried on |
| -------- | ---------- |
| Billed requests: chat completions, Responses, embeddings, rerank, `images.generate()`, `images.edit()`, speech, transcriptions, video generations and edits, `inference.run()` | 429 and 503, and a connection that could not be opened |
| Other requests: models, balance, account profile and picture, health, `images.download()` | 408, 429, 502, 503, and 504, and connection errors |

On billed requests, a 408, 502 or 504 answer, or a connection lost after the
request may have been sent, is returned to you without a retry, because the
request may already have been processed and charged. Earlier versions retried
these on every request. `maxRetries` applies to both groups, and
`maxRetries: 0` turns retries off.

On billed requests, a 429 or 503 answer is sent again after the wait described
above, up to `maxRetries` times. This includes a
503 whose message asks you to contact support before repeating the request.
To check the request's outcome first, set `maxRetries: 0` on that call.

```typescript
import DevupAI from "devupai";

// No retries for any call made with this client.
const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
  maxRetries: 0,
});

async function main() {
  // Up to 5 retries for this call only.
  const models = await client.models.list({ maxRetries: 5 });
  console.log(models.data.length);
}

main().catch(console.error);
```

---

# Timeouts and Cancellation

- `timeout` (default 600000 ms, 10 minutes) is one deadline for the whole call,
  retries included.
- For streams, `timeout` covers the time until the response headers arrive.
  Set `streamIdleTimeout` to stop a stream when no data arrives for that many
  milliseconds.
- A timeout throws `APITimeoutError`.
- For video generation and long `inference.run` calls, set a longer `timeout`
  (for example `900_000`) and `maxRetries: 0`.
- Pass `signal` to cancel a call. A signal that is already aborted rejects the
  call before any request is sent; an abort rejects with the signal's reason.

```typescript
import DevupAI, { APITimeoutError } from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
  timeout: 60_000,
  streamIdleTimeout: 30_000,
});

async function main() {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await client.chat.completions.create(
      {
        model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
        messages: [{ role: "user", content: "Hello." }],
      },
      { signal: controller.signal },
    );
    console.log(response.choices[0]?.message?.content);
  } catch (error) {
    if (error instanceof APITimeoutError) {
      console.error("The request timed out.");
      return;
    }
    throw error;
  }
}

main().catch(console.error);
```

---

# Error Handling

Every API error is a `DevupAPIError`. The SDK throws a subclass that matches
the HTTP status, so you can catch a specific case or the base class.

| Class                   | Status      | Notes                                                              |
| ----------------------- | ----------- | ------------------------------------------------------------------ |
| `BadRequestError`       | 400         | The request is not valid as sent; `code` names the reason.         |
| `AuthenticationError`   | 401         | Missing or invalid API key.                                        |
| `PaymentRequiredError`  | 402         | The balance does not cover the request (`insufficient_balance`), or a scoped credential reached its budget (`budget_exhausted`). |
| `PermissionDeniedError` | 403         | The key cannot use this resource. From `images.download()`: the link has expired; generate the file again. |
| `NotFoundError`         | 404         | For example, an unknown model.                                     |
| `ConflictError`         | 409         | The outcome of this request is not confirmed yet (`request_outcome_pending`). Do not send it again: contact support with `requestId`. |
| `PayloadTooLargeError`  | 413         | The request body is larger than the limit (`payload_too_large`). See [Request Size Limits](#request-size-limits). |
| `UnsupportedMediaTypeError` | 415     | The model does not accept the content type of the request (`invalid_request_error`, or a more specific `code`). Send the `Content-Type` and body format that the API reference lists for the endpoint. |
| `UnprocessableEntityError` | 422      | The request was not accepted in its current form.                  |
| `RateLimitError`        | 429         | Read `retryAfterMs` for the suggested wait.                        |
| `InternalServerError`   | 500 and up  | After a 500 or 502 the request may already have been processed and billed: check its outcome before sending it again. |
| `APIConnectionError`    | `0`         | The API could not be reached.                                      |
| `APITimeoutError`       | `0`         | The call exceeded `timeout` or `streamIdleTimeout`. Extends `APIConnectionError`. |
| `DevupAPIError`         | other       | Any other status.                                                  |

`BadRequestError`, `PaymentRequiredError`, `PayloadTooLargeError`, and
`UnprocessableEntityError` are new in 4.2.0, and `UnsupportedMediaTypeError`
in 4.3.0. Like the other classes, they extend `DevupAPIError`, so existing
`instanceof DevupAPIError` and `error.status` checks keep working. Match
`error.code` for the specific reason, for example
`missing_required_parameter`, `invalid_value`, `content_policy_violation`, or
`context_length_exceeded` (400), `payload_too_large` (413),
`model_at_capacity` (429), `reference_audio_not_found` (404),
`request_outcome_pending` (409), `server_error` (500), or
`DEVUP_COMPUTE_ERROR` (502).

| Property       | Type                     | Description                                                              |
| -------------- | ------------------------ | ------------------------------------------------------------------------ |
| `status`       | `number`                 | HTTP status code, or `0` for connection errors and timeouts.             |
| `message`      | `string`                 | Human-readable error message.                                            |
| `type`         | `string \| undefined`    | Error category when available.                                           |
| `code`         | `string \| undefined`    | Machine-readable error code when available.                              |
| `param`        | `string \| null`         | The request parameter the error refers to, when available.               |
| `requestId`    | `string \| null`         | The `x-request-id` header. Include it when you contact support.          |
| `clientRequestId` | `string \| null`      | The `x-client-request-id` header.                                        |
| `retryAfter`   | `string \| null`         | Raw `Retry-After` response header value.                                 |
| `retryAfterMs` | `number \| null`         | Suggested wait in milliseconds, when the response gives one.             |
| `warnings`     | `string[]`               | Notice codes from the `X-DEVUP-Warnings` header (empty when none).       |
| `headers`      | `Record<string, string>` | Response headers, with lower-case names.                                 |
| `cause`        | `unknown`                | The underlying error, when available.                                    |

The error codes you can act on are listed at
[docs.devupai.com/docs/errors](https://docs.devupai.com/docs/errors).

```typescript
import DevupAI, {
  AuthenticationError,
  BadRequestError,
  DevupAPIError,
  RateLimitError,
} from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function main() {
  try {
    await client.chat.completions.create({
      model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
      messages: [
        {
          role: "user",
          content: "Hello.",
        },
      ],
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error("Check your API key.");
      return;
    }

    if (error instanceof BadRequestError && error.code === "context_length_exceeded") {
      console.error("Shorten the conversation:", error.message);
      return;
    }

    if (error instanceof RateLimitError) {
      console.error("Rate limit reached. Suggested wait (ms):", error.retryAfterMs);
      return;
    }

    if (error instanceof DevupAPIError) {
      console.error("Status:", error.status);
      console.error("Message:", error.message);
      console.error("Code:", error.code);
      console.error("Param:", error.param);
      console.error("Request ID:", error.requestId);
      return;
    }

    throw error;
  }
}

main().catch(console.error);
```

An error reported inside a stream after it has started (chat completions or
Responses) is thrown from the `for await` loop as a `DevupAPIError` with the
error's `code` and the stream's `requestId`.

Webhook signature and payload verification errors throw `DevupWebhookVerificationError`. It is not an API error, carries no HTTP status code, and represents a local verification result.

| Property  | Type                                  | Description                                                           |
| --------- | ------------------------------------- | --------------------------------------------------------------------- |
| `name`    | `"DevupWebhookVerificationError"`     | Error class identifier.                                               |
| `message` | `string`                              | Human-readable description of the verification error.                 |
| `reason`  | `DevupWebhookVerificationErrorReason` | Machine-readable reason code.                                         |
| `cause`   | `unknown`                             | Underlying error when available (e.g. `SyntaxError` on invalid JSON). |

## Request Size Limits

The request body of chat completions, Responses, embeddings, rerank, image
generation and edits, transcriptions, and video can be up to 10,485,760 bytes
(10 MiB), files and Base64-encoded file data included. A larger body returns
HTTP 413 `payload_too_large`, thrown as `PayloadTooLargeError`; the body is not
processed and the request is not charged. For large input images or video
media, send an `https://` URL instead of the file.

Some arrays have a limit too: chat `messages` takes up to 512 entries and
embeddings `input` up to 2,048 texts. A longer array returns HTTP 400
`payload_too_large`, thrown as `BadRequestError`.

---

# API Behaviour Since 4.1.0

Since the release of `devupai` 4.1.0, the API answers these cases as follows.
The 4.3.0 types and this README describe them; no method changes its
signature.

- **Image model options:** a model's own options, and `image_params` on the
  model object. See [Model Options](#model-options).
- **Required options:** an option, image, or mask a model needs, left out,
  returns HTTP 400 `missing_required_parameter`.
- **Prompt rules per model:** a model can take no prompt or an optional
  prompt, and can list a longest prompt, counted in Unicode code points (an
  emoji counts as one); a longer prompt returns HTTP 400 `invalid_value`.
- **Input images:** each model lists how many input images it takes and how
  large they can be; a larger image returns HTTP 400 `invalid_value`.
- **Masks:** a model lists its mask format (`alpha` or `black_and_white`), and
  some models need a mask on every edit.
- **Content policy:** both image endpoints return HTTP 400
  `content_policy_violation` when the model's content policy does not allow
  the request. The request is not charged.
- **Request size:** embeddings, rerank, Responses, and transcriptions return
  HTTP 413 `payload_too_large` above 10,485,760 bytes (10 MiB). Chat
  completions, images, and video have the same limit.
- **Reference audio:** on speech with a model that clones a voice, a
  `referenceAudioUrl` that names a reference clip that is not one of this
  account's clips, or is no longer available, returns HTTP 404
  `reference_audio_not_found`. The request is not charged.
- **Model strings:** on chat completions, Responses, rerank, video, and
  native inference, a model identifier longer than 200 characters, or one
  that is not one or more segments joined by `/` (each starting with a letter
  or digit and made only of letters, digits, `.`, `_`, and `-`), returns HTTP
  404 `model_not_found`.
- **Multipart image fields:** on image generation and edits, a field such as
  `n` or `size`, or a structured option, sent more than once returns HTTP 400
  `invalid_value`.

---

# TypeScript

The request and response types are generated from the DEVUP AI OpenAPI
specification and exported by name: for example `ChatCompletion`,
`ChatCompletionChunk`, `ChatCompletionCreateParams`, `ResponseObject`,
`ResponseStreamEvent`, `EmbeddingCreateResponse`, `ModelObject`, and
`DevUpBilling`. `inference.run()` takes a generic for its model-dependent
result. The image option types are `ImageParams`, `ImageParamsOption`, and
`ImageParamsInputs`.

Types that list string values, such as `ImageParamsOption["kind"]` or
`ImageParamsInputs["mask_format"]`, list the values the API sends today. New
enum values may be added, so give a `switch` over them a `default` case.

```typescript
import DevupAI, {
  type ChatCompletion,
  type ChatCompletionCreateParamsNonStreaming,
} from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

const request: ChatCompletionCreateParamsNonStreaming = {
  model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
  messages: [
    {
      role: "user",
      content: "Hello from TypeScript.",
    },
  ],
};

async function typedCompletion(): Promise<ChatCompletion> {
  return client.chat.completions.create(request);
}

typedCompletion()
  .then((response) => {
    console.log(response.choices[0]?.message?.content);
  })
  .catch(console.error);
```

---

# Runtime and Security

- Node.js 22 or later. The core package ships ESM and CommonJS builds;
  `devupai/ai` is ESM-only.
- Built on the standard `fetch`, `AbortSignal`, and Web Crypto APIs, with zero
  runtime dependencies. Pass `fetch` to use your own implementation.
- Webhook signature verification uses Web Crypto (`globalThis.crypto.subtle`)
  and runs asynchronously in Node.js, Edge runtimes, Cloudflare Workers, Deno,
  Bun, and browsers.
- The SDK manages the `Authorization` and `Content-Type` headers.
- `health.check()` and `images.download()` never send your API key.
- `images.download()` only fetches URLs on the API's own origin, and refuses a
  URL that contains a user name or password.
- The SDK never logs your API key or writes it anywhere.

Store API keys in environment variables or a server-side secret manager.

Never expose API keys in browser bundles, public repositories, or client-side
environment variables.

---

# Models

DEVUP AI offers models across multiple modalities:

- Chat and reasoning
- Image generation and editing
- Embeddings
- Speech recognition
- Text-to-speech
- Video generation and editing
- Reranking and specialized inference

Model availability may change over time. `client.models.list()` and the live
catalog are the source of truth:

<p align="center">
  <a href="https://devupai.com/models"><strong>Browse available models →</strong></a>
</p>

---

# Get an API Key

1. Create an account at [devupai.com](https://devupai.com).
2. Open the [DEVUP AI Dashboard](https://devupai.com/dashboard).
3. Top up your balance using a supported payment method.
4. Generate an API key from the [API Keys page](https://devupai.com/dashboard/api-keys).
5. Store it securely as `DEVUP_API_KEY`.

```bash
DEVUP_API_KEY=<your-api-key>
```

---

# Resources

| Resource      | Link                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| Website       | [devupai.com](https://devupai.com)                                       |
| Documentation | [docs.devupai.com](https://docs.devupai.com/)                            |
| Dashboard     | [devupai.com/dashboard](https://devupai.com/dashboard)                   |
| API Keys      | [devupai.com/dashboard/api-keys](https://devupai.com/dashboard/api-keys) |
| Models        | [devupai.com/models](https://devupai.com/models)                         |
| Status        | [status.devupai.com](https://status.devupai.com/)                        |
| npm           | [npmjs.com/package/devupai](https://www.npmjs.com/package/devupai)       |
| Changelog     | [CHANGELOG.md](https://github.com/devupai-platform/devupai-node/blob/main/CHANGELOG.md) |
| Migration     | [MIGRATION_V3_TO_V4.md](https://github.com/devupai-platform/devupai-node/blob/main/MIGRATION_V3_TO_V4.md) |

---

# License

The DEVUP AI Node.js SDK is released under the
[MIT License](https://github.com/devupai-platform/devupai-node/blob/main/LICENSE).

<p align="center">
  <strong>Built for Algeria. Compatible with the global AI ecosystem.</strong>
</p>

<p align="center">
  <a href="https://devupai.com">Website</a>
  ·
  <a href="https://docs.devupai.com/">Documentation</a>
  ·
  <a href="https://www.npmjs.com/package/devupai">npm</a>
</p>
