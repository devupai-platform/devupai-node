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
declare class DevupAPIError extends Error {
    status: number;
    constructor(status: number, message: string);
}
/**
 * Common request options available on all resource methods.
 */
interface RequestOptions {
    /** Abort signal to cancel the request. */
    signal?: AbortSignal | null;
    /** Request timeout in milliseconds. */
    timeout?: number;
}
/**
 * A text content part for multimodal messages.
 */
interface TextContentPart {
    type: 'text';
    text: string;
}
/**
 * An image URL content part for multimodal/vision messages.
 */
interface ImageURLContentPart {
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
type ContentPart = TextContentPart | ImageURLContentPart;
/**
 * A chat completion message parameter.
 * Supports both simple string content and multimodal content arrays.
 */
interface ChatCompletionMessageParam {
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
interface ChatCompletionToolCall {
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
interface ChatCompletionTool {
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
interface ChatCompletionCreateParams extends RequestOptions {
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
    response_format?: {
        type: 'text' | 'json_object' | 'json_schema';
    };
    /** Tools (functions) the model may call. */
    tools?: ChatCompletionTool[];
    /** Controls how the model selects tools. */
    tool_choice?: 'none' | 'auto' | 'required' | {
        type: 'function';
        function: {
            name: string;
        };
    };
}
/**
 * A chat completion response.
 */
interface ChatCompletion {
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
interface ChatCompletionChunk {
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
type DevUpModel = 'devup-coder-v1' | 'devup-fast-v1' | 'devup-reasoning-v1' | 'devup-vision-v1' | (string & {});
/**
 * Configuration options for the DEVUP AI HTTP client.
 */
interface DevUpAIOptions {
    /** Your DEVUP AI API key. */
    apiKey: string;
    /**
     * Base URL for the API.
     * @default "https://api.devupai.com/v1"
     */
    baseURL?: string;
}
/** Parameters for image generation. */
interface ImageGenerateParams extends RequestOptions {
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
interface ImageGenerateResponse {
    data: Array<{
        url?: string;
        b64_json?: string;
    }>;
}
/** Parameters for creating embeddings. */
interface EmbeddingCreateParams extends RequestOptions {
    /** The model to use for embeddings. */
    model: string;
    /** The text(s) to embed. */
    input: string | string[];
    /** Encoding format for the embedding values. */
    encoding_format?: 'float' | 'base64';
}
/** A single embedding object. */
interface EmbeddingObject {
    object: 'embedding';
    embedding: number[];
    index: number;
}
/** Response from embedding creation. */
interface EmbeddingCreateResponse {
    object: 'list';
    data: EmbeddingObject[];
    model: string;
    usage: {
        prompt_tokens: number;
        total_tokens: number;
    };
}
/** Parameters for text-to-speech synthesis. */
interface SpeechCreateParams extends RequestOptions {
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
interface TranscriptionCreateParams extends RequestOptions {
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
interface TranscriptionResponse {
    text: string;
}
/** Parameters for video generation. */
interface VideoGenerationCreateParams extends RequestOptions {
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
interface VideoGenerationResponse {
    data: Array<{
        url: string;
    }>;
}
/** Parameters for document reranking. */
interface RerankingCreateParams extends RequestOptions {
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
interface RerankingResult {
    index: number;
    relevance_score: number;
    document?: string;
}
/** Response from reranking. */
interface RerankingCreateResponse {
    results: RerankingResult[];
}
/** A model object from the models listing endpoint. */
interface ModelObject {
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
}
/** Response from listing available models. */
interface ModelListResponse {
    object: 'list';
    data: ModelObject[];
}
declare class Completions {
    private apiKey;
    private baseURL;
    constructor(apiKey: string, baseURL: string);
    /**
     * Creates a streaming chat completion.
     * @param params - Chat completion parameters with `stream: true`.
     * @returns An async iterable of chat completion chunks.
     */
    create(params: ChatCompletionCreateParams & {
        stream: true;
    }): Promise<AsyncIterable<ChatCompletionChunk>>;
    /**
     * Creates a non-streaming chat completion.
     * @param params - Chat completion parameters.
     * @returns A complete chat completion response.
     */
    create(params: ChatCompletionCreateParams & {
        stream?: false;
    }): Promise<ChatCompletion>;
    private streamCompletions;
}
declare class Chat {
    completions: Completions;
    constructor(apiKey: string, baseURL: string);
}
declare class Models {
    private apiKey;
    private baseURL;
    constructor(apiKey: string, baseURL: string);
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
    list(options?: RequestOptions): Promise<ModelListResponse>;
}
declare class Images {
    private apiKey;
    private baseURL;
    constructor(apiKey: string, baseURL: string);
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
    generate(params: ImageGenerateParams): Promise<ImageGenerateResponse>;
}
declare class Embeddings {
    private apiKey;
    private baseURL;
    constructor(apiKey: string, baseURL: string);
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
    create(params: EmbeddingCreateParams): Promise<EmbeddingCreateResponse>;
}
declare class Speech {
    private apiKey;
    private baseURL;
    constructor(apiKey: string, baseURL: string);
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
    create(params: SpeechCreateParams): Promise<ArrayBuffer>;
}
declare class Transcriptions {
    private apiKey;
    private baseURL;
    constructor(apiKey: string, baseURL: string);
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
    create(params: TranscriptionCreateParams): Promise<TranscriptionResponse>;
}
declare class VideoGenerations {
    private apiKey;
    private baseURL;
    constructor(apiKey: string, baseURL: string);
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
    create(params: VideoGenerationCreateParams): Promise<VideoGenerationResponse>;
}
declare class Reranking {
    private apiKey;
    private baseURL;
    constructor(apiKey: string, baseURL: string);
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
    create(params: RerankingCreateParams): Promise<RerankingCreateResponse>;
}
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
declare class DevupAI {
    /** Chat completions resource. */
    chat: Chat;
    /** Available models resource. */
    models: Models;
    /** Image generation resource. */
    images: Images;
    /** Text embeddings resource. */
    embeddings: Embeddings;
    /** Audio resources (speech synthesis and transcription). */
    audio: {
        speech: Speech;
        transcriptions: Transcriptions;
    };
    /** Video generation resource. */
    video: {
        generations: VideoGenerations;
    };
    /** Document reranking resource. */
    reranking: Reranking;
    constructor(options: DevUpAIOptions);
}

export { type ChatCompletion, type ChatCompletionChunk, type ChatCompletionCreateParams, type ChatCompletionMessageParam, type ChatCompletionTool, type ChatCompletionToolCall, type ContentPart, type DevUpAIOptions, type DevUpModel, DevupAPIError, type EmbeddingCreateParams, type EmbeddingCreateResponse, type EmbeddingObject, type ImageGenerateParams, type ImageGenerateResponse, type ImageURLContentPart, type ModelListResponse, type ModelObject, type RequestOptions, type RerankingCreateParams, type RerankingCreateResponse, type RerankingResult, type SpeechCreateParams, type TextContentPart, type TranscriptionCreateParams, type TranscriptionResponse, type VideoGenerationCreateParams, type VideoGenerationResponse, DevupAI as default };
