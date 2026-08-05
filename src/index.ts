import type { components } from "./internal/openapi-schema";

export type ChatCompletion = components['schemas']['ChatCompletionResponse'];
export type DevUpBilling = components['schemas']['DevUpBilling'];

export interface ChatCompletionChunkDelta {
    role?: "system" | "user" | "assistant" | "tool";
    content?: string | null;
    tool_calls?: unknown[];
}

export interface ChatCompletionChunkChoice {
    index: number;
    delta: ChatCompletionChunkDelta;
    finish_reason?: string | null;
}

export interface ChatCompletionDeltaChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: ChatCompletionChunkChoice[];
}

export interface ChatCompletionBillingChunk {
    _devup: DevUpBilling;
    choices?: never;
}

export type ChatCompletionChunk =
    | ChatCompletionDeltaChunk
    | ChatCompletionBillingChunk;

function stripHeader(headers: Record<string, string>, name: string) {
    const lower = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower) delete headers[key];
    }
}

function buildJsonHeaders(apiKey: string, defaultHeaders?: Record<string, string>, paramsHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...defaultHeaders, ...paramsHeaders };
    stripHeader(headers, 'authorization');
    stripHeader(headers, 'content-type');
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['Content-Type'] = 'application/json';
    return headers;
}

function buildMultipartHeaders(apiKey: string, defaultHeaders?: Record<string, string>, paramsHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...defaultHeaders, ...paramsHeaders };
    stripHeader(headers, 'authorization');
    stripHeader(headers, 'content-type');
    headers['Authorization'] = `Bearer ${apiKey}`;
    return headers;
}

function buildPublicHeaders(defaultHeaders?: Record<string, string>, paramsHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...defaultHeaders, ...paramsHeaders };
    stripHeader(headers, 'authorization');
    return headers;
}


function buildAuthHeaders(apiKey: string, defaultHeaders?: Record<string, string>, paramsHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...defaultHeaders, ...paramsHeaders };
    stripHeader(headers, 'authorization');
    headers['Authorization'] = `Bearer ${apiKey}`;
    return headers;
}

export type ChatCompletionMessageParam = components['schemas']['ChatCompletionRequest']['messages'][number];
export type ChatCompletionCreateParams = Omit<components['schemas']['ChatCompletionRequest'], 'stream'> & {
    stream?: boolean;
};

export type ImageGenerateParams = Omit<components['schemas']['ImageGenerationRequest'], 'size' | 'n'> & {
    size?: string;
    n?: number;
};
export type ImageGenerateResponse = components['schemas']['ImageGenerationResponse'];

export type ImageEditParams = Omit<components['schemas']['ImageEditRequest'], 'image' | 'mask' | 'size' | 'n'> & {
    image: Blob | File | Uint8Array;
    mask?: Blob | File | Uint8Array;
    size?: string;
    n?: number;
};

export type EmbeddingCreateParams = Omit<components['schemas']['EmbeddingRequest'], 'encoding_format'> & {
    encoding_format?: "float" | "base64";
};
export type EmbeddingCreateResponse = components['schemas']['EmbeddingResponse'];

export type SpeechCreateParams = Omit<components['schemas']['SpeechRequest'], 'voice' | 'response_format'> & {
    voice?: string;
    response_format?: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
};
export type SpeechResponse = components['schemas']['SpeechResponse'];

export type TranscriptionCreateParams = Omit<components['schemas']['TranscriptionRequest'], 'file' | 'model' | 'response_format'> & {
    file: Blob | File | Uint8Array;
    model?: string;
    response_format?: "json" | "verbose_json" | "text" | "srt" | "vtt";
};
export type TranscriptionResponse = components['schemas']['TranscriptionResponse'];
export type TranscriptionVerboseResponse = components['schemas']['TranscriptionVerboseResponse'];

export type VideoGenerationCreateParams = components['schemas']['VideoGenerationRequest'];
export type VideoGenerationResponse = components['schemas']['VideoGenerationResponse'];
export type VideoEditCreateParams = Omit<components['schemas']['VideoEditRequest'], 'video' | 'mask' | 'key_points' | 'frame_index' | 'auto_trim' | 'preserve_audio' | 'background_color' | 'desired_increase'> & {
    video: Blob | File | Uint8Array;
    mask?: Blob | File | Uint8Array;
    key_points?: string | VideoKeyPoint[];
    frame_index?: number;
    auto_trim?: boolean;
    preserve_audio?: boolean;
    background_color?: string;
    desired_increase?: 2 | 4;
};
export type VideoKeyPoint = {
    x: number;
    y: number;
    type: "positive" | "negative";
};
// VideoEdit Response is same as VideoGenerationResponse

export type ModelListResponse = components['schemas']['ModelListResponse'];
export type ModelObject = components['schemas']['ModelObject'];
export type BalanceResponse = components['schemas']['BalanceResponse'];
export type HealthResponse = components['schemas']['HealthResponse'];

/**
 * Common request options available on all resource methods.
 */
export interface RequestOptions {
    /** Abort signal to cancel the request. */
    signal?: AbortSignal | null;
    /** Request timeout in milliseconds. */
    timeout?: number;
    /** Custom headers to send with the request. */
    headers?: Record<string, string>;
}

/**
 * Error thrown by the DEVUP AI API client.
 */
export class DevupAPIError extends Error {
    readonly status: number;
    readonly type: string | undefined;
    readonly code: string | undefined;
    readonly requestId: string | null;
    readonly retryAfter: string | null;
    readonly headers: Record<string, string>;
    readonly cause: unknown;

    constructor(
        status: number,
        message: string,
        errorData?: { type?: string; code?: string },
        headers?: Headers,
        cause?: unknown
    ) {
        super(message);
        this.status = status;
        this.type = errorData?.type;
        this.code = errorData?.code;
        this.cause = cause;
        this.name = 'DevupAPIError';

        const headersRecord: Record<string, string> = {};
        if (headers) {
            headers.forEach((val, key) => {
                headersRecord[key.toLowerCase()] = val;
            });
        }
        this.headers = headersRecord;
        this.requestId = headersRecord['x-request-id'] || null;
        this.retryAfter = headersRecord['retry-after'] || null;

        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export interface DevUpAIOptions {
    apiKey: string;
    baseURL?: string;
    headers?: Record<string, string>;
}

// Internal helpers



function buildSignal(options: RequestOptions) {
    const controller = new AbortController();
    let timeoutId: any;
    if (options.timeout) {
        timeoutId = setTimeout(() => controller.abort(), options.timeout);
    }
    if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
    }
    return {
        signal: controller.signal,
        cleanup: () => { if (timeoutId) clearTimeout(timeoutId); }
    };
}

function stripRequestOptions<T extends RequestOptions>(params: T): Omit<T, keyof RequestOptions> {
    const { headers: _headers, timeout: _timeout, signal: _signal, ...rest } = params;
    return rest;
}

async function safeFetch(url: string, init: RequestInit): Promise<Response> {
    try {
        return await fetch(url, init);
    } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        if (err instanceof Error && err.name === "AbortError") throw err;
        let msg = 'Unknown error';
        if (err instanceof Error && err.message) {
            msg = err.message;
        } else if (typeof err === 'string' && err) {
            msg = err;
        } else if (err && typeof err === 'object') {
            const str = String(err);
            if (str !== '[object Object]') {
                msg = str;
            }
        }
        throw new DevupAPIError(0, `Network error: ${msg}`, undefined, undefined, err);
    }
}

async function throwIfNotOk(response: Response): Promise<void> {
    if (response.ok) return;

    let errorMsg = response.statusText;
    let errorData: { type?: string; code?: string } | undefined;

    const bodyText = await response.text().catch(() => "");

    if (bodyText) {
        try {
            const errBody = JSON.parse(bodyText);
            if (errBody && errBody.error && typeof errBody.error === "object") {
                if (errBody.error.message) {
                    errorMsg = errBody.error.message;
                } else {
                    errorMsg = bodyText;
                }
                errorData = {
                    type: errBody.error.type,
                    code: errBody.error.code
                };
            } else {
                errorMsg = bodyText;
            }
        } catch {
            errorMsg = bodyText;
        }
    }

    if (!errorMsg || errorMsg.trim() === "") {
        errorMsg = `HTTP ${response.status}`;
    }

    throw new DevupAPIError(
        response.status,
        errorMsg,
        errorData,
        response.headers,
        undefined
    );
}

class Completions {


    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}

    create(params: ChatCompletionCreateParams & { stream: true } & RequestOptions): Promise<AsyncIterable<ChatCompletionChunk>>;
    create(params: ChatCompletionCreateParams & { stream?: false } & RequestOptions): Promise<ChatCompletion>;
    async create(params: ChatCompletionCreateParams & RequestOptions): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>> {
        const { signal, cleanup } = buildSignal(params);
        try {
            const payload = stripRequestOptions(params);
            const response = await safeFetch(`${this.baseURL}/chat/completions`, {
                method: "POST",
                headers: buildJsonHeaders(this.apiKey, this.defaultHeaders, params.headers),
                body: JSON.stringify(payload),
                signal
            });
            await throwIfNotOk(response);
            if (params.stream) {
                // Ownership transferred
                return this.streamCompletions(response, cleanup);
            }
            const data = await response.json();
            cleanup();
            return data as ChatCompletion;
        } catch (e) {
            cleanup();
            throw e;
        }
    }

    private async *streamCompletions(response: Response, cleanup: () => void): AsyncIterable<ChatCompletionChunk> {
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
                        } catch (_e: any) {
                            // Ignore malformed JSON
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

class Chat {
    completions: Completions;
    constructor(apiKey: string, baseURL: string, defaultHeaders?: Record<string, string>) {
        this.completions = new Completions(apiKey, baseURL, defaultHeaders);
    }
}

class Models {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    async list(options: RequestOptions = {}): Promise<ModelListResponse> {
        const { signal, cleanup } = buildSignal(options);
        try {
            const response = await safeFetch(`${this.baseURL}/models`, {
                method: "GET",
                headers: buildPublicHeaders(this.defaultHeaders, options.headers),
                signal
            });
            await throwIfNotOk(response);
            return response.json();
        } finally {
            cleanup();
        }
    }
}

class Images {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    async generate(params: ImageGenerateParams & RequestOptions): Promise<ImageGenerateResponse> {
        const { signal, cleanup } = buildSignal(params);
        try {
            const response = await safeFetch(`${this.baseURL}/images/generations`, {
                method: "POST",
                headers: buildJsonHeaders(this.apiKey, this.defaultHeaders, params.headers),
                body: JSON.stringify(stripRequestOptions(params)),
                signal
            });
            await throwIfNotOk(response);
            return response.json();
        } finally {
            cleanup();
        }
    }

    async edit(params: ImageEditParams & RequestOptions): Promise<ImageGenerateResponse> {
        const { signal, cleanup } = buildSignal(params);
        const formData = new FormData();
        const image = params.image as any;
        formData.append("image", image instanceof Uint8Array ? new Blob([image as any]) : image);
        const mask = params.mask as any;
        if (mask) {
            formData.append("mask", mask instanceof Uint8Array ? new Blob([mask as any]) : mask);
        }
        if (params.prompt) formData.append("prompt", params.prompt);
        if (params.model) if (params.model !== undefined) {
            formData.append("model", params.model);
        }
        if (params.n !== undefined) formData.append("n", params.n.toString());
        if (params.size) formData.append("size", params.size);

        try {
            const response = await safeFetch(`${this.baseURL}/images/generations`, {
                method: "POST",
                headers: buildMultipartHeaders(this.apiKey, this.defaultHeaders, params.headers),
                body: formData,
                signal
            });
            await throwIfNotOk(response);
            return response.json();
        } finally {
            cleanup();
        }
    }

    async proxy(params: { url: string } & RequestOptions): Promise<Response> {
        const { signal, cleanup } = buildSignal(params);
        try {
            const proxyURL = new URL(`${this.baseURL}/images/proxy`);
            proxyURL.searchParams.set("url", params.url);
            const response = await safeFetch(proxyURL.toString(), {
                method: "GET",
                headers: buildPublicHeaders(this.defaultHeaders, params.headers),
                signal
            });
            await throwIfNotOk(response);
            return response;
        } finally {
            cleanup();
        }
    }
}

class Embeddings {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    async create(params: EmbeddingCreateParams & RequestOptions): Promise<EmbeddingCreateResponse> {
        const { signal, cleanup } = buildSignal(params);
        try {
            const response = await safeFetch(`${this.baseURL}/embeddings`, {
                method: "POST",
                headers: buildJsonHeaders(this.apiKey, this.defaultHeaders, params.headers),
                body: JSON.stringify(stripRequestOptions(params)),
                signal
            });
            await throwIfNotOk(response);
            return response.json();
        } finally {
            cleanup();
        }
    }
}

class AudioSpeech {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    async create(params: SpeechCreateParams & RequestOptions): Promise<SpeechResponse> {
        const { signal, cleanup } = buildSignal(params);
        try {
            const response = await safeFetch(`${this.baseURL}/audio/speech`, {
                method: "POST",
                headers: buildJsonHeaders(this.apiKey, this.defaultHeaders, params.headers),
                body: JSON.stringify(stripRequestOptions(params)),
                signal
            });
            await throwIfNotOk(response);
            return response.json();
        } finally {
            cleanup();
        }
    }
}

class AudioTranscriptions {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}

    create(params: TranscriptionCreateParams & { response_format: 'text' | 'srt' | 'vtt' } & RequestOptions): Promise<string>;
    create(params: TranscriptionCreateParams & { response_format: 'verbose_json' } & RequestOptions): Promise<TranscriptionVerboseResponse>;
    create(params: TranscriptionCreateParams & { response_format?: 'json' } & RequestOptions): Promise<TranscriptionResponse>;
    async create(params: TranscriptionCreateParams & RequestOptions): Promise<TranscriptionResponse | TranscriptionVerboseResponse | string> {
        const { signal, cleanup } = buildSignal(params);
        const formData = new FormData();
        const file = params.file as any;
        formData.append("file", file instanceof Uint8Array ? new Blob([file as any]) : file);
        if (params.model !== undefined) {
            formData.append("model", params.model);
        }
        if (params.language) formData.append("language", params.language);
        if (params.response_format) formData.append("response_format", params.response_format);

        try {
            const response = await safeFetch(`${this.baseURL}/audio/transcriptions`, {
                method: "POST",
                headers: buildMultipartHeaders(this.apiKey, this.defaultHeaders, params.headers),
                body: formData,
                signal
            });
            await throwIfNotOk(response);
            if (params.response_format === "text" || params.response_format === "srt" || params.response_format === "vtt") {
                return response.text();
            }
            return response.json();
        } finally {
            cleanup();
        }
    }
}

class VideoGenerations {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    async create(params: VideoGenerationCreateParams & RequestOptions): Promise<VideoGenerationResponse> {
        const { signal, cleanup } = buildSignal(params);
        try {
            const response = await safeFetch(`${this.baseURL}/video/generations`, {
                method: "POST",
                headers: buildJsonHeaders(this.apiKey, this.defaultHeaders, params.headers),
                body: JSON.stringify(stripRequestOptions(params)),
                signal
            });
            await throwIfNotOk(response);
            return response.json();
        } finally {
            cleanup();
        }
    }
}

class VideoEdits {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    async create(params: VideoEditCreateParams & RequestOptions): Promise<VideoGenerationResponse> {
        const { signal, cleanup } = buildSignal(params);
        const formData = new FormData();
        const video = params.video;
        formData.append("video", video instanceof Uint8Array ? new Blob([video as BlobPart]) : video);

        if (params.model !== undefined) if (params.model !== undefined) {
            formData.append("model", params.model);
        }
        if (params.prompt !== undefined) formData.append("prompt", params.prompt);

        const mask = params.mask;
        if (mask !== undefined) {
            formData.append("mask", mask instanceof Uint8Array ? new Blob([mask as BlobPart]) : mask);
        }

        if (params.mask_url !== undefined) formData.append("mask_url", params.mask_url);
        if (params.key_points !== undefined) {
            const kp = typeof params.key_points === 'string' ? params.key_points : JSON.stringify(params.key_points);
            formData.append("key_points", kp);
        }
        if (params.frame_index !== undefined) formData.append("frame_index", params.frame_index.toString());
        if (params.auto_trim !== undefined) formData.append("auto_trim", params.auto_trim.toString());
        if (params.preserve_audio !== undefined) formData.append("preserve_audio", params.preserve_audio.toString());
        if (params.background_color !== undefined) formData.append("background_color", params.background_color);
        if (params.desired_increase !== undefined) formData.append("desired_increase", params.desired_increase.toString());
        if (params.output_container_and_codec !== undefined) formData.append("output_container_and_codec", params.output_container_and_codec);

        try {
            const response = await safeFetch(`${this.baseURL}/video/generations`, {
                method: "POST",
                headers: buildMultipartHeaders(this.apiKey, this.defaultHeaders, params.headers),
                body: formData,
                signal
            });
            await throwIfNotOk(response);
            return response.json();
        } finally {
            cleanup();
        }
    }
}

class NativeInference {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    async run<TResponse = unknown, TPayload extends Record<string, unknown> = Record<string, unknown>>(modelPath: string, payload: TPayload, options: RequestOptions = {}): Promise<TResponse> {
        const { signal, cleanup } = buildSignal(options);
        try {
            const cleanPath = modelPath.replace(/^\/+/, '');
            // Only encode if not already encoded, or simply encode parts?
            // Actually, percent encode the whole model path, but prevent double encoding.
            // A simple decode->encode guarantees it's encoded exactly once.
            let encodedPath = cleanPath;
            try {
                encodedPath = encodeURIComponent(decodeURIComponent(cleanPath));
            } catch (_e) {
                encodedPath = encodeURIComponent(cleanPath);
            }

            const response = await safeFetch(`${this.baseURL}/inference/${encodedPath}`, {
                method: "POST",
                headers: buildJsonHeaders(this.apiKey, this.defaultHeaders, options.headers),
                body: JSON.stringify(payload),
                signal
            });
            await throwIfNotOk(response);
            return response.json();
        } finally {
            cleanup();
        }
    }
}

class Balance {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    async retrieve(options: RequestOptions = {}): Promise<BalanceResponse> {
        const { signal, cleanup } = buildSignal(options);
        try {
            const response = await safeFetch(`${this.baseURL}/user/balance`, {
                method: "GET",
                headers: buildAuthHeaders(this.apiKey, this.defaultHeaders, options.headers),
                signal
            });
            await throwIfNotOk(response);
            return response.json();
        } finally {
            cleanup();
        }
    }
}

class Health {
    constructor(private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    async check(options: RequestOptions = {}): Promise<HealthResponse> {
        const { signal, cleanup } = buildSignal(options);
        try {
            const url = new URL('../health', this.baseURL.endsWith('/') ? this.baseURL : this.baseURL + '/').toString();
            const response = await safeFetch(url, {
                method: "GET",
                headers: buildPublicHeaders(this.defaultHeaders, options.headers),
                signal
            });
            await throwIfNotOk(response);
            return response.json();
        } finally {
            cleanup();
        }
    }
}

class DevupAI {
    baseURL: string;
    chat: Chat;
    models: Models;
    images: Images;
    embeddings: Embeddings;
    audio: {
        speech: AudioSpeech;
        transcriptions: AudioTranscriptions;
    };
    video: {
        generations: VideoGenerations;
        edits: VideoEdits;
    };
    inference: NativeInference;
    balance: Balance;
    health: Health;

    constructor(options: DevUpAIOptions) {
        const baseURL = (options.baseURL || "https://api.devupai.com/api/v1").replace(/\/+$/, "");
        this.baseURL = baseURL;
        const apiKey = options.apiKey;
        const defaultHeaders = options.headers;
        this.chat = new Chat(apiKey, baseURL, defaultHeaders);
        this.models = new Models(apiKey, baseURL, defaultHeaders);
        this.images = new Images(apiKey, baseURL, defaultHeaders);
        this.embeddings = new Embeddings(apiKey, baseURL, defaultHeaders);
        this.audio = {
            speech: new AudioSpeech(apiKey, baseURL, defaultHeaders),
            transcriptions: new AudioTranscriptions(apiKey, baseURL, defaultHeaders)
        };
        this.video = {
            generations: new VideoGenerations(apiKey, baseURL, defaultHeaders),
            edits: new VideoEdits(apiKey, baseURL, defaultHeaders)
        };
        this.inference = new NativeInference(apiKey, baseURL, defaultHeaders);
        this.balance = new Balance(apiKey, baseURL, defaultHeaders);
        this.health = new Health(baseURL, defaultHeaders);
    }
}

export default DevupAI;
