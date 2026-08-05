<p align="center">
  <a href="https://devupai.com">
    <img
      src="https://devupai.com/image/devu.png"
      alt="DEVUP AI"
      width="200"
    />
  </a>
</p>

<h1 align="center">DEVUP AI â€” Official Node.js SDK</h1>

<p align="center">
  <strong>Build with leading AI models. Pay in Algerian Dinar.</strong>
</p>

<p align="center">
  A TypeScript-first SDK for chat, images, embeddings, audio, video, and specialized inference
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
  آ·
  <a href="https://devupai.com/dashboard"><strong>Dashboard</strong></a>
  آ·
  <a href="https://devupai.com/dashboard/api-keys"><strong>API Keys</strong></a>
  آ·
  <a href="https://devupai.com/models"><strong>Models</strong></a>
  آ·
  <a href="https://status.devupai.com/"><strong>Status</strong></a>
  آ·
  <a href="https://www.npmjs.com/package/devupai"><strong>npm</strong></a>
</p>

---

## Overview

`devupai` is the official Node.js and TypeScript SDK for
[DEVUP AI](https://devupai.com), an AI inference gateway built for developers
and businesses in Algeria.

It gives you one consistent interface for:

- Chat and reasoning
- Image generation and editing
- Text embeddings
- Text-to-speech and transcription
- Video generation and editing
- Specialized native inference
- Model discovery, account balance, and health operations
- Vercel AI SDK integrations

> **Core client:** zero runtime dependencies.
> **Vercel AI SDK provider:** available through the optional `devupai/ai` export.

## Contents

- [Why DEVUP AI](#why-devup-ai)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Capability Matrix](#capability-matrix)
- [Core SDK](#core-sdk)
- [Vercel AI SDK](#vercel-ai-sdk)
- [Configuration](#configuration)
- [Request Options](#request-options)
- [TypeScript](#typescript)
- [Error Handling](#error-handling)
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
| **TypeScript-first contracts** | Typed public requests and responses derived from the DEVUP AI OpenAPI specification.     |
| **Modern runtime support**     | Designed for Node.js 18+, browsers, and Edge-compatible environments.                    |
| **Vercel AI SDK provider**     | Use `generateText`, `streamText`, route handlers, and UI streaming through `devupai/ai`. |
| **Operational visibility**     | Query models, account balance, service health, and billing metadata.                     |

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
    model: "deepseek-ai/DeepSeek-V4-Pro",
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

---

## Capability Matrix

| Capability       | SDK method                             | Authentication |
| ---------------- | -------------------------------------- | -------------- |
| Chat completions | `client.chat.completions.create()`     | Required       |
| Image generation | `client.images.generate()`             | Required       |
| Image editing    | `client.images.edit()`                 | Required       |
| Image proxy      | `client.images.proxy()`                | Public         |
| Embeddings       | `client.embeddings.create()`           | Required       |
| Text-to-speech   | `client.audio.speech.create()`         | Required       |
| Transcription    | `client.audio.transcriptions.create()` | Required       |
| Video generation | `client.video.generations.create()`    | Required       |
| Video editing    | `client.video.edits.create()`          | Required       |
| Native inference | `client.inference.run()`               | Required       |
| Model discovery  | `client.models.list()`                 | Public         |
| Account balance  | `client.balance.retrieve()`            | Required       |
| Service health   | `client.health.check()`                | Public         |

> Public operations omit the `Authorization` header.

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
    model: "deepseek-ai/DeepSeek-V4-Pro",
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
  console.log("Cost:", response._devup?.cost_dzd, "DZD");
  console.log("Balance:", response._devup?.balance_dzd, "DZD");
}

generateResponse().catch(console.error);
```

## Streaming

Streaming responses can contain:

1. Standard OpenAI-compatible delta chunks.
2. A final DEVUP billing chunk containing `_devup`.

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function streamResponse() {
  const stream = await client.chat.completions.create({
    model: "deepseek-ai/DeepSeek-V4-Pro",
    messages: [
      {
        role: "user",
        content: "Write a short poem about Algeria.",
      },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    if ("_devup" in chunk) {
      console.log("\n");
      console.log("Cost:", chunk._devup.cost_dzd, "DZD");
      console.log("Remaining balance:", chunk._devup.balance_dzd, "DZD");
      continue;
    }

    process.stdout.write(chunk.choices?.[0]?.delta?.content ?? "");
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
    model: "black-forest-labs/FLUX.1-schnell",
    prompt: "A cinematic view of Algiers at sunset",
    size: "1024x1024",
  });

  console.log(response.data[0]?.url);
  console.log("Cost:", response._devup?.cost_dzd, "DZD");
}

generateImage().catch(console.error);
```

</details>

<details>
<summary><strong>Edit an image</strong></summary>

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function editImage() {
  const image = new Blob(["image-data"], {
    type: "image/png",
  });

  const response = await client.images.edit({
    model: "black-forest-labs/FLUX.1-schnell",
    image,
    prompt: "Add a red sports car in the foreground",
  });

  console.log(response.data[0]?.url);
}

editImage().catch(console.error);
```

</details>

---

## Embeddings

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function createEmbeddings() {
  const response = await client.embeddings.create({
    model: "BAAI/bge-m3",
    input: ["Hello world", "ظ…ط±ط­ط¨ط§ ط¨ط§ظ„ط¹ط§ظ„ظ…", "Bonjour le monde"],
  });

  console.log(response.data[0]?.embedding);
  console.log("Dimensions:", response.data[0]?.embedding?.length);
}

createEmbeddings().catch(console.error);
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
    model: "kokoro",
    input: "Welcome to DEVUP AI.",
    voice: "af_sky",
  });

  console.log("Audio URL:", response.url);
  console.log("Cost:", response._devup.cost_dzd, "DZD");
  console.log("Balance:", response._devup.balance_dzd, "DZD");
}

createSpeech().catch(console.error);
```

</details>

<details>
<summary><strong>Speech-to-text</strong></summary>

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function transcribeAudio() {
  const audio = new Blob(["audio-data"], {
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
    model: "Wan-AI/Wan2.1-T2V-14B",
    prompt: "A camel walking through the Sahara at golden hour",
    width: 1280,
    height: 720,
  });

  console.log(response.data[0]?.url);
  console.log("Cost:", response._devup?.cost_dzd, "DZD");
}

generateVideo().catch(console.error);
```

</details>

<details>
<summary><strong>Edit a video</strong></summary>

```typescript
import DevupAI, { type VideoKeyPoint } from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function editVideo() {
  const video = new Blob(["video-data"], {
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
    model: "video-edit-model",
    video,
    prompt: "Enhance the subject while preserving the background",
    key_points: keyPoints,
    preserve_audio: true,
  });

  console.log(response.data[0]?.url);
}

editVideo().catch(console.error);
```

</details>

---

## Native Inference

Native inference supports specialized models whose inputs and outputs do not
follow a standard OpenAI schema.

The response type defaults to `unknown`. Provide a generic type when your
application knows the expected result shape.

```typescript
import DevupAI from "devupai";

interface RerankResponse {
  results: Array<{
    index: number;
    score: number;
  }>;
}

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function rerankDocuments() {
  const response = await client.inference.run<RerankResponse>(
    "example-org/example-reranker-model",
    {
      query: "What is DEVUP AI?",
      documents: [
        "DEVUP AI is an AI inference gateway.",
        "Algiers is the capital of Algeria.",
      ],
    },
  );

  console.log(response.results);
}

rerankDocuments().catch(console.error);
```

---

## Models, Balance, and Health

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

  const balance = await client.balance.retrieve();
  console.log("Balance:", balance.balance_dzd, "DZD");
}

inspectAccount().catch(console.error);
```

---

## Image Proxy

The image proxy returns a native `Response`, giving you direct access to its
headers and binary body.

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function proxyImage() {
  const response = await client.images.proxy({
    url: "https://example.com/image.jpg",
  });

  console.log("Content-Type:", response.headers.get("content-type"));

  const image = await response.arrayBuffer();
  console.log("Image bytes:", image.byteLength);
}

proxyImage().catch(console.error);
```

---

# Vercel AI SDK

Use the optional `devupai/ai` export with the Vercel AI SDK.

```bash
npm install ai @ai-sdk/openai-compatible @ai-sdk/provider
```

## Generate text

```typescript
import { generateText } from "ai";
import { createDevupAI } from "devupai/ai";

const devupai = createDevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function main() {
  const { text } = await generateText({
    model: devupai("deepseek-ai/DeepSeek-V4-Pro"),
    prompt: "Explain neural networks in simple terms.",
  });

  console.log(text);
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
    model: devupai("deepseek-ai/DeepSeek-V4-Pro"),
    prompt: "Write a short story set in Algiers.",
  });

  for await (const text of result.textStream) {
    process.stdout.write(text);
  }
}

main().catch(console.error);
```

## Next.js plain-text streaming

```typescript
import { streamText } from "ai";
import { createDevupAI } from "devupai/ai";

const devupai = createDevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

export async function POST(request: Request) {
  const body = await request.json();

  const result = streamText({
    model: devupai("deepseek-ai/DeepSeek-V4-Pro"),
    messages: body.messages,
  });

  return result.toTextStreamResponse();
}
```

## Next.js UI streaming

```typescript
import { streamText } from "ai";
import { createDevupAI } from "devupai/ai";

const devupai = createDevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

export async function POST(request: Request) {
  const body = await request.json();

  const result = streamText({
    model: devupai("deepseek-ai/DeepSeek-V4-Pro"),
    messages: body.messages,
  });

  return result.toUIMessageStreamResponse();
}
```

---

# Configuration

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
  baseURL: "https://api.devupai.com/api/v1",
  headers: {
    "X-Application-Name": "my-application",
  },
});
```

| Option    | Type                     | Required | Default                          | Description                                 |
| --------- | ------------------------ | -------: | -------------------------------- | ------------------------------------------- |
| `apiKey`  | `string`                 |      Yes | â€”                                | Your DEVUP AI API key.                      |
| `baseURL` | `string`                 |       No | `https://api.devupai.com/api/v1` | DEVUP AI API base URL.                      |
| `headers` | `Record<string, string>` |       No | â€”                                | Custom headers included in client requests. |

Protected authentication and content-type headers are managed by the SDK.

---

# Request Options

Resource methods accept common request options alongside their request
parameters.

| Option    | Type                     | Description                                                   |
| --------- | ------------------------ | ------------------------------------------------------------- |
| `signal`  | `AbortSignal \| null`    | Cancel a request with an external abort signal.               |
| `timeout` | `number`                 | Abort the request after the specified number of milliseconds. |
| `headers` | `Record<string, string>` | Add request-specific custom headers.                          |

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function requestWithTimeout() {
  const response = await client.chat.completions.create({
    model: "deepseek-ai/DeepSeek-V4-Pro",
    messages: [
      {
        role: "user",
        content: "Summarize Algeria in three sentences.",
      },
    ],
    timeout: 30_000,
    headers: {
      "X-Request-Source": "documentation-example",
    },
  });

  console.log(response.choices[0]?.message?.content);
}

requestWithTimeout().catch(console.error);
```

---

# TypeScript

The SDK exposes typed public request and response contracts derived from the
DEVUP AI OpenAPI specification, curated ergonomic request types, typed streaming
chunks, and safe generics for model-dependent native inference.

```typescript
import DevupAI, {
  type ChatCompletion,
  type ChatCompletionCreateParams,
} from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

const request: Omit<ChatCompletionCreateParams, "stream"> = {
  model: "deepseek-ai/DeepSeek-V4-Pro",
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

# Error Handling

API and transport failures are represented by `DevupAPIError`.

| Property     | Type                     | Description                                     |
| ------------ | ------------------------ | ----------------------------------------------- |
| `status`     | `number`                 | HTTP status code, or `0` for a network failure. |
| `message`    | `string`                 | Human-readable error message.                   |
| `type`       | `string \| undefined`    | API error category when available.              |
| `code`       | `string \| undefined`    | Machine-readable API error code when available. |
| `requestId`  | `string \| null`         | DEVUP request identifier when returned.         |
| `retryAfter` | `string \| null`         | Raw `Retry-After` response header value.        |
| `headers`    | `Record<string, string>` | Normalized response headers.                    |
| `cause`      | `unknown`                | Original underlying error when available.       |

```typescript
import DevupAI, { DevupAPIError } from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

async function main() {
  try {
    await client.chat.completions.create({
      model: "deepseek-ai/DeepSeek-V4-Pro",
      messages: [
        {
          role: "user",
          content: "Hello.",
        },
      ],
    });
  } catch (error) {
    if (error instanceof DevupAPIError) {
      console.error("DEVUP API request failed");
      console.error("Status:", error.status);
      console.error("Message:", error.message);
      console.error("Type:", error.type);
      console.error("Code:", error.code);
      console.error("Request ID:", error.requestId);
      console.error("Retry-After:", error.retryAfter);
      return;
    }

    throw error;
  }
}

main().catch(console.error);
```

---

# Runtime and Security

- Node.js 18+ support
- Browser and Edge-compatible request primitives
- Protected authentication and content-type headers
- Public methods that omit authorization
- Timeout and external abort-signal support
- Native `Response` support for image proxy operations
- No API key persistence performed by the SDK

Store API keys in environment variables or a server-side secret manager.

Never expose API keys in browser bundles, public repositories, or client-side
environment variables.

---

# Models

DEVUP AI supports models across multiple modalities:

- Chat and reasoning
- Image generation and editing
- Embeddings
- Speech recognition
- Text-to-speech
- Video generation and editing
- Reranking and specialized inference

Model availability may evolve over time. The live catalog is the source of
truth:

<p align="center">
  <a href="https://devupai.com/models"><strong>Browse available models â†’</strong></a>
</p>

---

# Get an API Key

1. Create an account at [devupai.com](https://devupai.com).
2. Open the [DEVUP AI Dashboard](https://devupai.com/dashboard).
3. Top up your balance using a supported payment method.
4. Generate an API key from the [API Keys page](https://devupai.com/dashboard/api-keys).
5. Store it securely as `DEVUP_API_KEY`.

```bash
DEVUP_API_KEY=sk-devup-your-api-key
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

---

# License

The DEVUP AI Node.js SDK is released under the
[MIT License](https://github.com/devupai-platform/devupai-node/blob/main/LICENSE).

<p align="center">
  <strong>Built for Algeria. Compatible with the global AI ecosystem.</strong>
</p>

<p align="center">
  <a href="https://devupai.com">Website</a>
  آ·
  <a href="https://docs.devupai.com/">Documentation</a>
  آ·
  <a href="https://www.npmjs.com/package/devupai">npm</a>
</p>
