// src/index.ts
var DevupAPIError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "DevupAPIError";
  }
  status;
};
function composeSignals(signals) {
  if (signals.length === 1) return signals[0];
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener(
      "abort",
      () => controller.abort(signal.reason),
      { once: true }
    );
  }
  return controller.signal;
}
function buildSignal(options) {
  const controller = new AbortController();
  let timeoutId;
  if (options.timeout) {
    timeoutId = setTimeout(() => controller.abort("timeout"), options.timeout);
  }
  const signals = [controller.signal];
  if (options.signal) signals.push(options.signal);
  const signal = composeSignals(signals);
  return {
    signal,
    cleanup: () => {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };
}
async function safeFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    throw new DevupAPIError(
      0,
      `Network error: ${err.message}`
    );
  }
}
async function throwIfNotOk(response) {
  if (response.ok) return;
  let errorMsg = response.statusText;
  try {
    const errBody = await response.json();
    errorMsg = errBody.error?.message || JSON.stringify(errBody);
  } catch {
  }
  throw new DevupAPIError(response.status, errorMsg);
}
function stripRequestOptions(params) {
  const { signal: _s, timeout: _t, ...rest } = params;
  return rest;
}
var Completions = class {
  apiKey;
  baseURL;
  constructor(apiKey, baseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }
  async create(params) {
    const { signal: fetchSignal, cleanup } = buildSignal(params);
    const payload = stripRequestOptions(params);
    const response = await safeFetch(
      `${this.baseURL}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: fetchSignal
      }
    );
    await throwIfNotOk(response);
    if (params.stream) {
      return this.streamCompletions(response, cleanup);
    }
    cleanup();
    return response.json();
  }
  async *streamCompletions(response, cleanup) {
    if (!response.body) {
      cleanup();
      throw new Error("DEVUP_API_ERROR: Response body is missing");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith("data: ")) {
            const data = trimmedLine.slice(6).trim();
            if (data === "[DONE]") return;
            if (!data) continue;
            try {
              yield JSON.parse(data);
            } catch (e) {
            }
          }
        }
      }
    } finally {
      cleanup();
      reader.releaseLock();
    }
  }
};
var Chat = class {
  completions;
  constructor(apiKey, baseURL) {
    this.completions = new Completions(apiKey, baseURL);
  }
};
var Models = class {
  apiKey;
  baseURL;
  constructor(apiKey, baseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }
  /**
   * Lists all available models.
   *
   * @param options - Optional request options (signal, timeout).
   * @returns An OpenAI-compatible model list response.
   *
   * @example
   * ```typescript
   * const models = await client.models.list();
   * for (const model of models.data) {
   *   console.log(model.id, model.owned_by);
   * }
   * ```
   */
  async list(options = {}) {
    const { signal: fetchSignal, cleanup } = buildSignal(options);
    try {
      const response = await safeFetch(`${this.baseURL}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`
        },
        signal: fetchSignal
      });
      await throwIfNotOk(response);
      return response.json();
    } finally {
      cleanup();
    }
  }
};
var Images = class {
  apiKey;
  baseURL;
  constructor(apiKey, baseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }
  /**
   * Generates images from a text prompt.
   *
   * @param params - Image generation parameters.
   * @returns An array of generated image URLs or base64 data.
   *
   * @example
   * ```typescript
   * const result = await client.images.generate({
   *   model: "devup-image-v1",
   *   prompt: "A sunset over mountains",
   *   size: "1024x1024",
   * });
   * console.log(result.data[0].url);
   * ```
   */
  async generate(params) {
    const { signal: fetchSignal, cleanup } = buildSignal(params);
    const payload = stripRequestOptions(params);
    try {
      const response = await safeFetch(
        `${this.baseURL}/images/generations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(payload),
          signal: fetchSignal
        }
      );
      await throwIfNotOk(response);
      return response.json();
    } finally {
      cleanup();
    }
  }
};
var Embeddings = class {
  apiKey;
  baseURL;
  constructor(apiKey, baseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }
  /**
   * Creates embedding vectors from input text.
   *
   * @param params - Embedding parameters.
   * @returns An OpenAI-compatible embedding response.
   *
   * @example
   * ```typescript
   * const result = await client.embeddings.create({
   *   model: "devup-embed-v1",
   *   input: ["Hello world", "How are you?"],
   * });
   * console.log(result.data[0].embedding);
   * ```
   */
  async create(params) {
    const { signal: fetchSignal, cleanup } = buildSignal(params);
    const payload = stripRequestOptions(params);
    try {
      const response = await safeFetch(`${this.baseURL}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: fetchSignal
      });
      await throwIfNotOk(response);
      return response.json();
    } finally {
      cleanup();
    }
  }
};
var Speech = class {
  apiKey;
  baseURL;
  constructor(apiKey, baseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }
  /**
   * Generates speech audio from text.
   *
   * @param params - Speech synthesis parameters.
   * @returns Raw audio bytes as an ArrayBuffer.
   *
   * @example
   * ```typescript
   * const audioBuffer = await client.audio.speech.create({
   *   model: "devup-tts-v1",
   *   input: "Welcome to DEVUP AI!",
   *   voice: "alloy",
   *   response_format: "mp3",
   * });
   * // In Node.js: writeFileSync("speech.mp3", new Uint8Array(audioBuffer));
   * ```
   */
  async create(params) {
    const { signal: fetchSignal, cleanup } = buildSignal(params);
    const payload = stripRequestOptions(params);
    try {
      const response = await safeFetch(`${this.baseURL}/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: fetchSignal
      });
      await throwIfNotOk(response);
      return response.arrayBuffer();
    } finally {
      cleanup();
    }
  }
};
var Transcriptions = class {
  apiKey;
  baseURL;
  constructor(apiKey, baseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }
  /**
   * Transcribes audio to text.
   *
   * @param params - Transcription parameters including the audio file.
   * @returns The transcription result.
   *
   * @example
   * ```typescript
   * const result = await client.audio.transcriptions.create({
   *   model: "devup-whisper-v1",
   *   file: audioBlob,
   *   language: "en",
   * });
   * console.log(result.text);
   * ```
   */
  async create(params) {
    const { signal: fetchSignal, cleanup } = buildSignal(params);
    const formData = new FormData();
    if (params.file instanceof Uint8Array) {
      formData.append("file", new Blob([params.file]));
    } else {
      formData.append("file", params.file);
    }
    formData.append("model", params.model);
    if (params.language !== void 0)
      formData.append("language", params.language);
    if (params.prompt !== void 0) formData.append("prompt", params.prompt);
    if (params.response_format !== void 0)
      formData.append("response_format", params.response_format);
    try {
      const response = await safeFetch(
        `${this.baseURL}/audio/transcriptions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`
            // Content-Type intentionally omitted — runtime sets multipart boundary
          },
          body: formData,
          signal: fetchSignal
        }
      );
      await throwIfNotOk(response);
      return response.json();
    } finally {
      cleanup();
    }
  }
};
var VideoGenerations = class {
  apiKey;
  baseURL;
  constructor(apiKey, baseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }
  /**
   * Generates video from a text prompt.
   *
   * @param params - Video generation parameters.
   * @returns An array of generated video URLs.
   *
   * @example
   * ```typescript
   * const result = await client.video.generations.create({
   *   model: "devup-video-v1",
   *   prompt: "A cat playing piano",
   * });
   * console.log(result.data[0].url);
   * ```
   */
  async create(params) {
    const { signal: fetchSignal, cleanup } = buildSignal(params);
    const payload = stripRequestOptions(params);
    try {
      const response = await safeFetch(
        `${this.baseURL}/video/generations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(payload),
          signal: fetchSignal
        }
      );
      await throwIfNotOk(response);
      return response.json();
    } finally {
      cleanup();
    }
  }
};
var Reranking = class {
  apiKey;
  baseURL;
  constructor(apiKey, baseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }
  /**
   * Reranks documents by relevance to a query.
   *
   * @param params - Reranking parameters.
   * @returns Ranked results with relevance scores.
   *
   * @example
   * ```typescript
   * const result = await client.reranking.create({
   *   model: "devup-rerank-v1",
   *   query: "What is machine learning?",
   *   documents: [
   *     "ML is a subset of AI...",
   *     "The weather is sunny...",
   *   ],
   *   top_n: 1,
   * });
   * console.log(result.results[0].relevance_score);
   * ```
   */
  async create(params) {
    const { signal: fetchSignal, cleanup } = buildSignal(params);
    const payload = stripRequestOptions(params);
    try {
      const response = await safeFetch(`${this.baseURL}/reranking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: fetchSignal
      });
      await throwIfNotOk(response);
      return response.json();
    } finally {
      cleanup();
    }
  }
};
var DevupAI = class {
  /** Chat completions resource. */
  chat;
  /** Available models resource. */
  models;
  /** Image generation resource. */
  images;
  /** Text embeddings resource. */
  embeddings;
  /** Audio resources (speech synthesis and transcription). */
  audio;
  /** Video generation resource. */
  video;
  /** Document reranking resource. */
  reranking;
  constructor(options) {
    const baseURL = options.baseURL || "https://api.devupai.com/v1";
    const apiKey = options.apiKey;
    this.chat = new Chat(apiKey, baseURL);
    this.models = new Models(apiKey, baseURL);
    this.images = new Images(apiKey, baseURL);
    this.embeddings = new Embeddings(apiKey, baseURL);
    this.audio = {
      speech: new Speech(apiKey, baseURL),
      transcriptions: new Transcriptions(apiKey, baseURL)
    };
    this.video = { generations: new VideoGenerations(apiKey, baseURL) };
    this.reranking = new Reranking(apiKey, baseURL);
  }
};
export {
  DevupAPIError,
  DevupAI as default
};
