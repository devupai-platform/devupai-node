<p align="center">
  <img src="https://raw.githubusercontent.com/devupai-platform/.github/main/profile/devu.webp" alt="DEVUP AI" width="150" />
</p>

<h1 align="center">DEVUP AI — Official Node.js SDK</h1>

> Official Node.js SDK for [DEVUP AI](https://devupai.com) — Algeria's AI inference gateway.
> OpenAI-compatible API with 170+ models, billed in DZD via Edahabia & CIB.

[![npm version](https://img.shields.io/npm/v/devupai)](https://www.npmjs.com/package/devupai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

## Why DEVUP AI?

| Feature | Details |
|---------|---------|
| 🇩🇿 **Local Payments** | Pay in DZD via Edahabia & CIB |
| 💳 **No Visa Required** | No international card needed |
| 🤖 **170+ Models** | Llama, Qwen, DeepSeek, FLUX, Whisper, and more |
| ⚡ **OpenAI-Compatible** | Drop-in replacement — just change the base URL |
| 🌍 **Edge Ready** | Works in Vercel Edge, Cloudflare Workers, Deno, Bun |
| 🔒 **Zero Retention** | Your data is never stored |

## Installation

```bash
npm install devupai
```

## Quick Start

```typescript
import DevupAI from "devupai";

const client = new DevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

const response = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.choices[0].message.content);
```

## Features

- ✅ Chat completions (streaming + non-streaming)
- ✅ Image generation (FLUX, SDXL, and more)
- ✅ Text embeddings (BGE-M3, multilingual)
- ✅ Text-to-speech & speech-to-text
- ✅ Video generation
- ✅ Reranking
- ✅ Model listing
- ✅ Vercel AI SDK compatible (via `devupai/ai`)
- ✅ Works in Node.js 18+, Browser, Edge Runtime, Deno, Bun
- ✅ Zero runtime dependencies
- ✅ Full TypeScript support

## Available Models

170+ open-source models across all modalities:

| Category | Models |
|----------|--------|
| 💬 Chat & Reasoning | Llama 3.3, Qwen 3, DeepSeek V3, Mistral, GPT OSS |
| 🖼️ Image Generation | FLUX.1 (schnell/dev/pro), SDXL, Wan Image |
| 🎵 Audio | Kokoro TTS, Whisper ASR, Chatterbox |
| 🎬 Video | Wan 2.6/2.7, Seedance, Pixverse |
| 📊 Embeddings | BGE-M3, Qwen3 Embedding, Nemotron |
| 🔍 Reranking | Qwen3 Reranker, Nemotron Reranker |

Full list: [devupai.com/models](https://devupai.com/models)

## Usage

### Chat Completions

```typescript
// Non-streaming
const response = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "What is Algeria's capital?" }
  ],
  temperature: 0.7,
  max_tokens: 1024,
});

// Streaming
const stream = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [{ role: "user", content: "Tell me a story." }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
```

### Image Generation

```typescript
const image = await client.images.generate({
  model: "black-forest-labs/FLUX.1-schnell",
  prompt: "A beautiful view of Algiers at sunset",
  size: "1024x1024",
});

console.log(image.data[0].url);
```

### Embeddings

```typescript
const result = await client.embeddings.create({
  model: "BAAI/bge-m3",
  input: ["Hello world", "مرحبا بالعالم", "Bonjour le monde"],
});

console.log(result.data[0].embedding); // number[]
```

### Text-to-Speech

```typescript
const audioBuffer = await client.audio.speech.create({
  model: "kokoro",
  input: "Welcome to DEVUP AI",
  voice: "af_sky",
});

// Save to file (Node.js)
import { writeFileSync } from "fs";
writeFileSync("output.mp3", Buffer.from(audioBuffer));
```

### Speech-to-Text

```typescript
const transcript = await client.audio.transcriptions.create({
  model: "openai/whisper-large-v3-turbo",
  file: audioFile, // File | Blob | Uint8Array
  language: "ar",
});

console.log(transcript.text);
```

### Video Generation

```typescript
const video = await client.video.generations.create({
  model: "Wan-AI/Wan2.1-T2V-14B",
  prompt: "A camel walking through the Sahara desert",
  width: 1280,
  height: 720,
});

console.log(video.data[0].url);
```

### List Models

```typescript
const models = await client.models.list();
console.log(models.data.map(m => m.id));
```

## cURL

No SDK required — works with any HTTP client:

```bash
curl https://api.devupai.com/v1/chat/completions \
  -H "Authorization: Bearer $DEVUP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Vercel AI SDK

Install the optional peer dependencies:

```bash
npm install @ai-sdk/openai-compatible @ai-sdk/provider
```

Then import from `devupai/ai`:

```typescript
import { createDevupAI } from "devupai/ai";
import { streamText, generateText, embed } from "ai";

const devupai = createDevupAI({
  apiKey: process.env.DEVUP_API_KEY!,
});

// With streamText
const { textStream } = await streamText({
  model: devupai("meta-llama/Llama-3.3-70B-Instruct-Turbo"),
  prompt: "Write a poem about Algeria.",
});

for await (const text of textStream) {
  process.stdout.write(text);
}

// With generateText
const { text } = await generateText({
  model: devupai("meta-llama/Llama-3.3-70B-Instruct-Turbo"),
  prompt: "Hello!",
});

// With useChat (Next.js)
// In your API route:
import { createDevupAI } from "devupai/ai";
import { streamText } from "ai";

const devupai = createDevupAI({ apiKey: process.env.DEVUP_API_KEY! });

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = await streamText({
    model: devupai("meta-llama/Llama-3.3-70B-Instruct-Turbo"),
    messages,
  });
  return result.toDataStreamResponse();
}
```

## Configuration

```typescript
const client = new DevupAI({
  apiKey: "dvup_...",          // Required
  baseURL: "https://api.devupai.com/v1",  // Optional — default shown
});
```

## TypeScript

All types are exported and ready to use:

```typescript
import DevupAI, {
  type ChatCompletionMessageParam,
  type ChatCompletion,
  type DevupAPIError,
} from "devupai";

const messages: ChatCompletionMessageParam[] = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Hello!" },
];
```

## Error Handling

```typescript
import DevupAI, { DevupAPIError } from "devupai";

try {
  await client.chat.completions.create({ ... });
} catch (err) {
  if (err instanceof DevupAPIError) {
    console.error(`API Error ${err.status}: ${err.message}`);
  }
}
```

## Get API Key

1. Sign up at [devupai.com](https://devupai.com)
2. Top up your balance in **DZD** via Edahabia or CIB (no Visa required)
3. Generate an API key at [devupai.com/dashboard/api-keys](https://devupai.com/dashboard/api-keys)

## Links

- 🌐 Website: [devupai.com](https://devupai.com)
- 📊 Dashboard: [devupai.com/dashboard](https://devupai.com/dashboard)
- 📚 Docs: [devupai.com/docs](https://devupai.com/docs)
- 🤖 Models: [devupai.com/models](https://devupai.com/models)

---

<p align="center">
  <img src="https://raw.githubusercontent.com/devupai-platform/.github/main/profile/devup%20170.png" alt="DEVUP AI — Pay in Dinar. Build with AI." />
</p>

## License

MIT — see [LICENSE](https://github.com/devupai-platform/devupai-node/blob/main/LICENSE) for details.
