/**
 * DEVUP AI SDK — Official Node.js client for the DEVUP AI inference gateway.
 *
 * Provides a zero-dependency HTTP client for all DEVUP AI endpoints plus
 * an optional Vercel AI SDK compatibility layer.
 *
 * @example
 * ```typescript
 * import DevupAI from "devupai";
 *
 * const client = new DevupAI({ apiKey: "dvup_..." });
 *
 * // Chat completion
 * const chat = await client.chat.completions.create({
 *   model: "devup-fast-v1",
 *   messages: [{ role: "user", content: "Hello!" }],
 * });
 *
 * // Image generation
 * const image = await client.images.generate({
 *   model: "devup-image-v1",
 *   prompt: "A sunset over mountains",
 * });
 * ```
 *
 * @module
 */



// ─── Error ────────────────────────────────────────────────────────────────────

/**
 * Error thrown by the DEVUP AI API client.
 *
 * Wraps both HTTP errors (non-2xx responses) and network-level errors
 * (DNS failures, connection refused, timeouts).
 *
 * @example
 * ```typescript
 * try {
 *   await client.chat.completions.create({ ... });
 * } catch (err) {
 *   if (err instanceof DevupAPIError) {
 *     console.error(`API error ${err.status}: ${err.message}`);
 *   }
 * }
 * ```
 */
export class DevupAPIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'DevupAPIError';
  }
}

// ─── Shared Request Options ───────────────────────────────────────────────────

/**
 * Common request options available on all resource methods.
 */
export interface RequestOptions {
  /** Abort signal to cancel the request. */
  signal?: AbortSignal | null;

  /** Request timeout in milliseconds. */
  timeout?: number;
}

// ─── Content Parts (multimodal) ───────────────────────────────────────────────

/**
 * A text content part for multimodal messages.
 */
export interface TextContentPart {
  type: 'text';
  text: string;
}

/**
 * An image URL content part for multimodal/vision messages.
 */
export interface ImageURLContentPart {
  type: 'image_url';
  image_url: {
    /** URL of the image (supports http/https and base64 data URIs). */
    url: string;
    /** Image detail level for vision processing. */
    detail?: 'low' | 'high' | 'auto';
  };
}

/**
 * A content part in a multimodal message.
 */
export type ContentPart = TextContentPart | ImageURLContentPart;

// ─── Chat Types ───────────────────────────────────────────────────────────────

/**
 * A chat completion message parameter.
 * Supports both simple string content and multimodal content arrays.
 */
export interface ChatCompletionMessageParam {
  /** The role of the message author. */
  role: 'system' | 'user' | 'assistant' | 'tool';

  /**
   * The content of the message.
   * Use a string for text-only messages, or an array of ContentPart for multimodal input.
   */
  content: string | ContentPart[];

  /** Tool call ID (for tool role messages). */
  tool_call_id?: string;

  /** Tool calls made by the assistant. */
  tool_calls?: ChatCompletionToolCall[];
}

/**
 * A tool call in a chat completion response.
 */
export interface ChatCompletionToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * A tool definition for function calling.
 */
export interface ChatCompletionTool {
  type: 'function';
  function: {
    /** The name of the function to call. */
    name: string;
    /** A description of what the function does. */
    description?: string;
    /** The parameters the function accepts (JSON Schema). */
    parameters?: Record<string, unknown>;
  };
}

/**
 * Parameters for creating a chat completion.
 */
export interface ChatCompletionCreateParams extends RequestOptions {
  /** The model to use for completion. */
  model: DevUpModel;

  /** The messages to generate a completion for. */
  messages: ChatCompletionMessageParam[];

  /** Whether to stream the response. */
  stream?: boolean;

  /** Sampling temperature (0-2). Higher = more random. */
  temperature?: number;

  /** Maximum number of tokens to generate. */
  max_tokens?: number;

  /** Nucleus sampling parameter. */
  top_p?: number;

  /** Stop sequences — generation stops when any of these are produced. */
  stop?: string | string[];

  /** Penalizes tokens based on their frequency in the output so far (-2.0 to 2.0). */
  frequency_penalty?: number;

  /** Penalizes tokens based on whether they appear in the output so far (-2.0 to 2.0). */
  presence_penalty?: number;

  /** Random seed for deterministic generation. */
  seed?: number;

  /** Response format specification. */
  response_format?: { type: 'text' | 'json_object' | 'json_schema' };

  /** Tools (functions) the model may call. */
  tools?: ChatCompletionTool[];

  /** Controls how the model selects tools. */
  tool_choice?:
    | 'none'
    | 'auto'
    | 'required'
    | { type: 'function'; function: { name: string } };
}

/**
 * A chat completion response.
 */
export interface ChatCompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatCompletionMessageParam;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * A streamed chat completion chunk.
 */
export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: {
    index: number;
    delta: Partial<ChatCompletionMessageParam>;
    finish_reason: string | null;
  }[];
}

/**
 * Known DEVUP AI model identifiers, with support for any custom string.
 */
export type DevUpModel =
  | 'devup-coder-v1'
  | 'devup-fast-v1'
  | 'devup-reasoning-v1'
  | 'devup-vision-v1'
  | (string & {});

/**
 * Configuration options for the DEVUP AI HTTP client.
 */
export interface DevUpAIOptions {
  /** Your DEVUP AI API key. */
  apiKey: string;

  /**
   * Base URL for the API.
   * @default "https://api.devupai.com/v1"
   */
  baseURL?: string;
}

// ─── Images Types ─────────────────────────────────────────────────────────────

/** Parameters for image generation. */
export interface ImageGenerateParams extends RequestOptions {
  /** The model to use for image generation. */
  model: string;

  /** A text prompt describing the desired image. */
  prompt: string;

  /** Number of images to generate. @default 1 */
  n?: number;

  /** Image dimensions (e.g. "1024x1024"). */
  size?: string;

  /** Output format. */
  response_format?: 'url' | 'b64_json';

  /** Number of denoising steps. */
  num_inference_steps?: number;

  /** Classifier-free guidance scale. */
  guidance_scale?: number;

  /** Negative prompt — what to avoid in the image. */
  negative_prompt?: string;

  /** Random seed for reproducibility. */
  seed?: number;
}

/** Response from image generation. */
export interface ImageGenerateResponse {
  data: Array<{ url?: string; b64_json?: string }>;
}

// ─── Embeddings Types ─────────────────────────────────────────────────────────

/** Parameters for creating embeddings. */
export interface EmbeddingCreateParams extends RequestOptions {
  /** The model to use for embeddings. */
  model: string;

  /** The text(s) to embed. */
  input: string | string[];

  /** Encoding format for the embedding values. */
  encoding_format?: 'float' | 'base64';
}

/** A single embedding object. */
export interface EmbeddingObject {
  object: 'embedding';
  embedding: number[];
  index: number;
}

/** Response from embedding creation. */
export interface EmbeddingCreateResponse {
  object: 'list';
  data: EmbeddingObject[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ─── Audio Types ──────────────────────────────────────────────────────────────

/** Parameters for text-to-speech synthesis. */
export interface SpeechCreateParams extends RequestOptions {
  /** The TTS model to use. */
  model: string;

  /** The text to synthesize. */
  input: string;

  /** The voice to use. */
  voice?: string;

  /** Audio output format. */
  response_format?: 'mp3' | 'wav' | 'opus' | 'flac';

  /** Speech speed multiplier (0.25 to 4.0). */
  speed?: number;
}

/** Parameters for audio transcription (speech-to-text). */
export interface TranscriptionCreateParams extends RequestOptions {
  /** The ASR model to use. */
  model: string;

  /** The audio file to transcribe. Accepts Blob, File, or Uint8Array. */
  file: Blob | File | Uint8Array;

  /** Language of the audio (ISO 639-1 code). */
  language?: string;

  /** Optional prompt to guide the transcription. */
  prompt?: string;

  /** Output format. */
  response_format?: 'json' | 'text' | 'srt' | 'vtt';
}

/** Response from audio transcription. */
export interface TranscriptionResponse {
  text: string;
}

// ─── Video Types ──────────────────────────────────────────────────────────────

/** Parameters for video generation. */
export interface VideoGenerationCreateParams extends RequestOptions {
  /** The video generation model to use. */
  model: string;

  /** A text prompt describing the desired video. */
  prompt: string;

  /** Negative prompt — what to avoid. */
  negative_prompt?: string;

  /** Video width in pixels. */
  width?: number;

  /** Video height in pixels. */
  height?: number;

  /** Number of frames to generate. */
  num_frames?: number;

  /** Random seed for reproducibility. */
  seed?: number;
}

/** Response from video generation. */
export interface VideoGenerationResponse {
  data: Array<{ url: string }>;
}

// ─── Reranking Types ──────────────────────────────────────────────────────────

/** Parameters for document reranking. */
export interface RerankingCreateParams extends RequestOptions {
  /** The reranking model to use. */
  model: string;

  /** The search query. */
  query: string;

  /** The documents to rerank. */
  documents: string[];

  /** Maximum number of results to return. */
  top_n?: number;

  /** Whether to include document text in the response. */
  return_documents?: boolean;
}

/** A single reranking result. */
export interface RerankingResult {
  index: number;
  relevance_score: number;
  document?: string;
}

/** Response from reranking. */
export interface RerankingCreateResponse {
  results: RerankingResult[];
}

// ─── Models Types ─────────────────────────────────────────────────────────────

/** A model object from the models listing endpoint. */
export interface ModelObject {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

/** Response from listing available models. */
export interface ModelListResponse {
  object: 'list';
  data: ModelObject[];
}

// ─── Signal Composition Utility ───────────────────────────────────────────────

/**
 * Composes multiple AbortSignals into a single signal that aborts
 * when ANY of the input signals abort.
 *
 * Works in Node.js 18+ (no AbortSignal.any required).
 */
function composeSignals(signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1) return signals[0];

  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener(
      'abort',
      () => controller.abort(signal.reason),
      { once: true },
    );
  }

  return controller.signal;
}

/**
 * Builds an AbortSignal from RequestOptions, composing user signal + timeout.
 * Returns the signal and a cleanup function to clear the timeout.
 */
function buildSignal(
  options: RequestOptions,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (options.timeout) {
    timeoutId = setTimeout(() => controller.abort('timeout'), options.timeout);
  }

  const signals: AbortSignal[] = [controller.signal];
  if (options.signal) signals.push(options.signal);

  const signal = composeSignals(signals);

  return {
    signal,
    cleanup: () => {
      if (timeoutId) clearTimeout(timeoutId);
    },
  };
}

// ─── Fetch Helpers ────────────────────────────────────────────────────────────

/**
 * Wraps fetch to catch network errors and throw DevupAPIError.
 */
async function safeFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    // Re-throw AbortError as-is so callers can detect cancellation
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    throw new DevupAPIError(
      0,
      `Network error: ${(err as Error).message}`,
    );
  }
}

/**
 * Throws a DevupAPIError if the response is not ok.
 */
async function throwIfNotOk(response: Response): Promise<void> {
  if (response.ok) return;

  let errorMsg = response.statusText;
  try {
    const errBody = await response.json();
    errorMsg = errBody.error?.message || JSON.stringify(errBody);
  } catch {
    // Ignore JSON parse error
  }
  throw new DevupAPIError(response.status, errorMsg);
}

/**
 * Strips RequestOptions fields from params before sending to the API.
 */
function stripRequestOptions<T extends RequestOptions>(
  params: T,
): Omit<T, 'signal' | 'timeout'> {
  const { signal: _s, timeout: _t, ...rest } = params;
  return rest;
}

// ─── Completions ──────────────────────────────────────────────────────────────

class Completions {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  /**
   * Creates a streaming chat completion.
   * @param params - Chat completion parameters with `stream: true`.
   * @returns An async iterable of chat completion chunks.
   */
  async create(
    params: ChatCompletionCreateParams & { stream: true },
  ): Promise<AsyncIterable<ChatCompletionChunk>>;

  /**
   * Creates a non-streaming chat completion.
   * @param params - Chat completion parameters.
   * @returns A complete chat completion response.
   */
  async create(
    params: ChatCompletionCreateParams & { stream?: false },
  ): Promise<ChatCompletion>;

  async create(
    params: ChatCompletionCreateParams,
  ): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>> {
    const { signal: fetchSignal, cleanup } = buildSignal(params);
    const payload = stripRequestOptions(params);

    const response = await safeFetch(
      `${this.baseURL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: fetchSignal,
      },
    );

    await throwIfNotOk(response);

    if (params.stream) {
      return this.streamCompletions(response, cleanup);
    }

    cleanup();
    return response.json() as Promise<ChatCompletion>;
  }

  private async *streamCompletions(
    response: Response,
    cleanup: () => void,
  ): AsyncIterable<ChatCompletionChunk> {
    if (!response.body) {
      cleanup();
      throw new Error('DEVUP_API_ERROR: Response body is missing');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6).trim();
            if (data === '[DONE]') return;
            if (!data) continue;

            try {
              yield JSON.parse(data) as ChatCompletionChunk;
            } catch (e) {
              // Ignore invalid JSON chunks
            }
          }
        }
      }
    } finally {
      cleanup();
      reader.releaseLock();
    }
  }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

class Chat {
  public completions: Completions;

  constructor(apiKey: string, baseURL: string) {
    this.completions = new Completions(apiKey, baseURL);
  }
}

// ─── Models ───────────────────────────────────────────────────────────────────

class Models {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string) {
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
  async list(options: RequestOptions = {}): Promise<ModelListResponse> {
    const { signal: fetchSignal, cleanup } = buildSignal(options);

    try {
      const response = await safeFetch(`${this.baseURL}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: fetchSignal,
      });

      await throwIfNotOk(response);
      return response.json() as Promise<ModelListResponse>;
    } finally {
      cleanup();
    }
  }
}

// ─── Images ───────────────────────────────────────────────────────────────────

class Images {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string) {
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
  async generate(params: ImageGenerateParams): Promise<ImageGenerateResponse> {
    const { signal: fetchSignal, cleanup } = buildSignal(params);
    const payload = stripRequestOptions(params);

    try {
      const response = await safeFetch(
        `${this.baseURL}/images/generations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: fetchSignal,
        },
      );

      await throwIfNotOk(response);
      return response.json() as Promise<ImageGenerateResponse>;
    } finally {
      cleanup();
    }
  }
}

// ─── Embeddings ───────────────────────────────────────────────────────────────

class Embeddings {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string) {
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
  async create(
    params: EmbeddingCreateParams,
  ): Promise<EmbeddingCreateResponse> {
    const { signal: fetchSignal, cleanup } = buildSignal(params);
    const payload = stripRequestOptions(params);

    try {
      const response = await safeFetch(`${this.baseURL}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: fetchSignal,
      });

      await throwIfNotOk(response);
      return response.json() as Promise<EmbeddingCreateResponse>;
    } finally {
      cleanup();
    }
  }
}

// ─── Audio: Speech (TTS) ─────────────────────────────────────────────────────

class Speech {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string) {
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
  async create(params: SpeechCreateParams): Promise<ArrayBuffer> {
    const { signal: fetchSignal, cleanup } = buildSignal(params);
    const payload = stripRequestOptions(params);

    try {
      const response = await safeFetch(`${this.baseURL}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: fetchSignal,
      });

      await throwIfNotOk(response);
      return response.arrayBuffer();
    } finally {
      cleanup();
    }
  }
}

// ─── Audio: Transcriptions (ASR) ─────────────────────────────────────────────

class Transcriptions {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string) {
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
  async create(
    params: TranscriptionCreateParams,
  ): Promise<TranscriptionResponse> {
    const { signal: fetchSignal, cleanup } = buildSignal(params);

    const formData = new FormData();

    // Handle Uint8Array by wrapping in a Blob
    if (params.file instanceof Uint8Array) {
      formData.append('file', new Blob([params.file as BlobPart]));
    } else {
      formData.append('file', params.file as Blob);
    }

    formData.append('model', params.model);

    if (params.language !== undefined)
      formData.append('language', params.language);
    if (params.prompt !== undefined) formData.append('prompt', params.prompt);
    if (params.response_format !== undefined)
      formData.append('response_format', params.response_format);

    try {
      const response = await safeFetch(
        `${this.baseURL}/audio/transcriptions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            // Content-Type intentionally omitted — runtime sets multipart boundary
          },
          body: formData,
          signal: fetchSignal,
        },
      );

      await throwIfNotOk(response);
      return response.json() as Promise<TranscriptionResponse>;
    } finally {
      cleanup();
    }
  }
}

// ─── Video: Generations ───────────────────────────────────────────────────────

class VideoGenerations {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string) {
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
  async create(
    params: VideoGenerationCreateParams,
  ): Promise<VideoGenerationResponse> {
    const { signal: fetchSignal, cleanup } = buildSignal(params);
    const payload = stripRequestOptions(params);

    try {
      const response = await safeFetch(
        `${this.baseURL}/video/generations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: fetchSignal,
        },
      );

      await throwIfNotOk(response);
      return response.json() as Promise<VideoGenerationResponse>;
    } finally {
      cleanup();
    }
  }
}

// ─── Reranking ────────────────────────────────────────────────────────────────

class Reranking {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string) {
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
  async create(
    params: RerankingCreateParams,
  ): Promise<RerankingCreateResponse> {
    const { signal: fetchSignal, cleanup } = buildSignal(params);
    const payload = stripRequestOptions(params);

    try {
      const response = await safeFetch(`${this.baseURL}/reranking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: fetchSignal,
      });

      await throwIfNotOk(response);
      return response.json() as Promise<RerankingCreateResponse>;
    } finally {
      cleanup();
    }
  }
}

// ─── DevupAI Client ───────────────────────────────────────────────────────────

/**
 * The main DEVUP AI client.
 *
 * Provides access to all DEVUP AI API endpoints through a resource-based interface.
 *
 * @example
 * ```typescript
 * import DevupAI from "devupai";
 *
 * const client = new DevupAI({ apiKey: "dvup_..." });
 *
 * // Chat
 * const chat = await client.chat.completions.create({
 *   model: "devup-fast-v1",
 *   messages: [{ role: "user", content: "Hello!" }],
 * });
 *
 * // Streaming
 * const stream = await client.chat.completions.create({
 *   model: "devup-fast-v1",
 *   messages: [{ role: "user", content: "Tell me a story" }],
 *   stream: true,
 * });
 * for await (const chunk of stream) {
 *   process.stdout.write(chunk.choices[0]?.delta?.content || "");
 * }
 *
 * // Images
 * const image = await client.images.generate({
 *   model: "devup-image-v1",
 *   prompt: "A sunset over mountains",
 * });
 *
 * // Embeddings
 * const embeddings = await client.embeddings.create({
 *   model: "devup-embed-v1",
 *   input: "Hello world",
 * });
 *
 * // Models
 * const models = await client.models.list();
 * ```
 */
export default class DevupAI {
  /** Chat completions resource. */
  public chat: Chat;

  /** Available models resource. */
  public models: Models;

  /** Image generation resource. */
  public images: Images;

  /** Text embeddings resource. */
  public embeddings: Embeddings;

  /** Audio resources (speech synthesis and transcription). */
  public audio: { speech: Speech; transcriptions: Transcriptions };

  /** Video generation resource. */
  public video: { generations: VideoGenerations };

  /** Document reranking resource. */
  public reranking: Reranking;

  constructor(options: DevUpAIOptions) {
    const baseURL = options.baseURL || 'https://api.devupai.com/v1';
    const apiKey = options.apiKey;

    this.chat = new Chat(apiKey, baseURL);
    this.models = new Models(apiKey, baseURL);
    this.images = new Images(apiKey, baseURL);
    this.embeddings = new Embeddings(apiKey, baseURL);
    this.audio = {
      speech: new Speech(apiKey, baseURL),
      transcriptions: new Transcriptions(apiKey, baseURL),
    };
    this.video = { generations: new VideoGenerations(apiKey, baseURL) };
    this.reranking = new Reranking(apiKey, baseURL);
  }
}
