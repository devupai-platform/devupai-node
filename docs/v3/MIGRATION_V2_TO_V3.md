# Migrating from V2 to DEVUP AI SDK V3

DEVUP AI SDK V3 is a major release that strictly aligns the SDK with the official OpenAPI contract. It brings full TypeScript support for all production API features, improved error handling, and robust Vercel AI SDK integration.

## 1. Native Inference Replaces `reranking`
The standalone `reranking` resource has been removed, as it is obsolete.
To use specialized and reranking models, use the `inference` resource:

```typescript
// V2
await client.reranking.create({ model: '<reranker-model-id>', query: 'q', documents: ['d'] });

// V3
await client.inference.run('<reranker-model-id>', { query: 'q', documents: ['d'] });
```

## 2. Updated DevupAPIError
The SDK's error class has been significantly improved. `Object.setPrototypeOf(this, new.target.prototype)` is utilized, making error subclassing safer and robust for `instanceof` checks. The error exposes HTTP-level metadata for robust retry logic:

```typescript
try {
  await client.chat.completions.create({
    model: "deepseek-ai/DeepSeek-V4-Pro",
    messages: []
  });
} catch (e) {
  if (e instanceof DevupAPIError) {
    console.log(e.status); // 400
    console.log(e.type); // "invalid_request_error"
    console.log(e.code); // "machine_readable_error_code"
    console.log(e.requestId); // "req_123"
    console.log(e.retryAfter); // 30
  }
}
```

## 3. `health.check()` and `images.proxy()` Are Available
You can now check service health, and fetch a generated image from a URL returned by the API.
Note that the `images.proxy` returns a native `Response` object instead of an ArrayBuffer.

```typescript
const health = await client.health.check();

// `imageUrl` is a `data[].url` value returned by `client.images.generate()`.
const imageResponse = await client.images.proxy({ url: imageUrl });
const contentType = imageResponse.headers.get("content-type");
const imageBuffer = await imageResponse.arrayBuffer();
```

> In 4.0.0 the method is renamed and takes the URL string itself: `client.images.download(imageUrl)`. See `MIGRATION_V3_TO_V4.md`.

## 4. `audio.speech` Returns JSON (Not Raw Buffer)
The contract specifies that `/audio/speech` returns a JSON object containing a URL to the generated audio and billing data, instead of streaming the raw binary.

```typescript
// V3
const response = await client.audio.speech.create({
  model: "hexgrad/Kokoro-82M",
  input: "Hello World",
  voice: "af_sky"
});
console.log(response.url);
console.log(response._devup.cost_dzd); // Billing payload
```

## 5. Explicit TypeScript Types (OpenAPI Contract)
All interfaces (`ChatCompletionCreateParams`, `ImageGenerateParams`, etc.) are now strictly generated directly from the public OpenAPI specification. Undocumented or internal properties have been purged. You will now get immediate compilation errors if you pass properties that the DEVUP AI platform does not support.
