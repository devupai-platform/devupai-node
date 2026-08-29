import type { components } from "./internal/openapi-schema";

export type DevUpBilling = components['schemas']['DevUpBilling'];

export type ChatCompletionMessage = components['schemas']['ChatMessage'] & {
    reasoning_content?: string | null;
};

export type ChatCompletionChoice = Omit<components['schemas']['ChatCompletionResponse']['choices'][number], 'message'> & {
    message?: ChatCompletionMessage;
};

export type TokenUsage = components['schemas']['TokenUsage'] & {
    reasoning_tokens?: number;
};

export type ChatCompletion = Omit<components['schemas']['ChatCompletionResponse'], 'choices' | 'usage'> & {
    choices: ChatCompletionChoice[];
    usage?: TokenUsage;
};

export interface ChatCompletionChunkDelta {
    role?: "system" | "user" | "assistant" | "tool";
    content?: string | null;
    reasoning_content?: string | null;
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

export type RerankCreateParams = components['schemas']['RerankRequest'];
export type RerankCreateResponse = components['schemas']['RerankResponse'];

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
 * Token usage details in webhook delivery payloads.
 */
export interface WebhookUsage {
    /** Number of prompt tokens processed. */
    prompt_tokens: number;
    /** Number of completion tokens generated. */
    completion_tokens: number;
}

/**
 * Successful webhook delivery payload sent when asynchronous inference completes.
 */
export interface WebhookSuccessPayload {
    /** Webhook delivery identifier (`whd_<uuid>`). */
    id: string;
    /** Status indicating successful inference execution. */
    status: "succeeded";
    /** Token consumption details. */
    usage: WebhookUsage;
    /** Final settled cost in Algerian Dinar (DZD). */
    cost_dzd: number;
    /** Billing settlement status. */
    settlement: "settled";
    /** Model execution results. */
    results: Array<Record<string, unknown>>;
}

/**
 * Details describing why an asynchronous inference request failed.
 */
export interface WebhookErrorDetails {
    /** Error classification category. */
    type: string;
    /** Human-readable explanation of the failure. */
    message: string;
}

/**
 * Failed webhook delivery payload sent when asynchronous inference fails.
 */
export interface WebhookErrorPayload {
    /** Webhook delivery identifier (`whd_<uuid>`). */
    id: string;
    /** Status indicating failed inference execution. */
    status: "failed";
    /** Token consumption details (zeroed on failure). */
    usage: WebhookUsage;
    /** Settled cost in DZD (`null` on failure). */
    cost_dzd: null;
    /** Billing settlement status. */
    settlement: "failed";
    /** Failure descriptor containing classification type and message. */
    error: WebhookErrorDetails;
}

/**
 * Inbound webhook delivery payload containing either success results or error details.
 */
export type WebhookEvent = WebhookSuccessPayload | WebhookErrorPayload;

/**
 * Specific failure reasons for webhook signature verification and payload construction.
 */
export type DevupWebhookVerificationErrorReason =
    | "malformed_header"
    | "timestamp_outside_tolerance"
    | "no_matching_signature"
    | "invalid_json";

/**
 * Error thrown when webhook payload construction or signature verification fails.
 */
export class DevupWebhookVerificationError extends Error {
    readonly reason: DevupWebhookVerificationErrorReason;
    readonly cause: unknown;

    constructor(reason: DevupWebhookVerificationErrorReason, message: string, cause?: unknown) {
        super(message);
        this.name = "DevupWebhookVerificationError";
        this.reason = reason;
        this.cause = cause;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Parameters for verifying an incoming DEVUP AI webhook request signature.
 */
export interface VerifyWebhookSignatureParams {
    /**
     * The raw, unparsed HTTP request body (string or Uint8Array).
     *
     * ⚠️ CRITICAL: `rawBody` MUST be the exact raw string or byte sequence received in the HTTP request.
     * Re-serialising a parsed JSON object changes whitespace and key ordering, causing signature verification to fail.
     */
    rawBody: string | Uint8Array;
    /**
     * The incoming `X-DevUp-Signature` HTTP header value:
     * `t=<unix_timestamp>,v1=<hex_signature>[,v1=<hex_signature>]`
     */
    signatureHeader: string;
    /**
     * The webhook signing secret configured in the DEVUP AI Dashboard.
     */
    secret: string;
    /**
     * Maximum allowed difference between request timestamp and current system time in seconds.
     * @default 300 (5 minutes)
     */
    toleranceSeconds?: number;
}

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

/** Chat completions resource. */
class Completions {


    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}

    /** Creates a model response for the given chat conversation. */
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

/** Chat resource. */
class Chat {
    completions: Completions;
    constructor(apiKey: string, baseURL: string, defaultHeaders?: Record<string, string>) {
        this.completions = new Completions(apiKey, baseURL, defaultHeaders);
    }
}

/** Available models resource. */
class Models {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    /** Lists the currently available models. */
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

/** 
 * Image generation and editing resource.
 * Note: Intentionally using `generate()` and `edit()` instead of the nested `generations.create()`
 * pattern to avoid a breaking major-version change in v3.
 */
class Images {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    /** Creates an image given a prompt. */
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

    /** Creates an edited or extended image given an original image and a prompt. */
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

    /** Securely proxies generated image URLs. */
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

/** Text embeddings resource. */
class Embeddings {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    /** Creates an embedding vector representing the input text. */
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

/** Document reranking resource. */
class Rerank {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    /** Reranks documents according to their semantic relevance to a query. */
    async create(params: RerankCreateParams & RequestOptions): Promise<RerankCreateResponse> {
        const { signal, cleanup } = buildSignal(params);
        try {
            const response = await safeFetch(`${this.baseURL}/rerank`, {
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

/** Audio speech synthesis resource. */
class AudioSpeech {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    /** Generates audio from the input text. */
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

/** Audio transcription resource. */
class AudioTranscriptions {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}

    create(params: TranscriptionCreateParams & { response_format: 'text' | 'srt' | 'vtt' } & RequestOptions): Promise<string>;
    create(params: TranscriptionCreateParams & { response_format: 'verbose_json' } & RequestOptions): Promise<TranscriptionVerboseResponse>;
    create(params: TranscriptionCreateParams & { response_format?: 'json' } & RequestOptions): Promise<TranscriptionResponse>;
    /** Transcribes audio into the input language. */
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

/** Video generation resource. */
class VideoGenerations {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    /** Creates a video generation task given a prompt. */
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

/** Video editing resource. */
class VideoEdits {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    /** Creates a video editing task given an original video and a prompt. */
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

/** Generic native inference resource. */
class NativeInference {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    /** Executes a raw request against a specific model. */
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

/** Account balance resource. */
class Balance {
    constructor(private apiKey: string, private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    /** Retrieves the current account balance in DZD. */
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

/** API health check resource. */
class Health {
    constructor(private baseURL: string, private defaultHeaders?: Record<string, string>) {}
    /** Checks the health of the DEVUP API gateway. */
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

interface WebhookVerificationInternalResult {
    ok: boolean;
    reason?: DevupWebhookVerificationErrorReason;
    errorMessage?: string;
    bodyString?: string;
}

async function verifyWebhookInternal(params: VerifyWebhookSignatureParams): Promise<WebhookVerificationInternalResult> {
    if (!params || typeof params !== "object") {
        return {
            ok: false,
            reason: "malformed_header",
            errorMessage: "Parameters object is required",
        };
    }

    const { rawBody, signatureHeader, secret, toleranceSeconds = 300 } = params;

    // Validate rawBody
    let bodyBytes: Uint8Array;
    let bodyString: string;
    if (typeof rawBody === "string") {
        bodyBytes = new TextEncoder().encode(rawBody);
        bodyString = rawBody;
    } else if (rawBody instanceof Uint8Array) {
        bodyBytes = rawBody;
        bodyString = new TextDecoder("utf-8").decode(rawBody);
    } else {
        return {
            ok: false,
            reason: "malformed_header",
            errorMessage: "rawBody must be a string or Uint8Array",
        };
    }

    // Validate signatureHeader format
    if (typeof signatureHeader !== "string" || signatureHeader.trim() === "") {
        return {
            ok: false,
            reason: "malformed_header",
            errorMessage: "Missing or empty signature header",
        };
    }

    const elements = signatureHeader.split(",");
    let timestamp: number | null = null;
    const signatures: string[] = [];

    for (const element of elements) {
        const trimmed = element.trim();
        if (!trimmed) continue;
        const equalIdx = trimmed.indexOf("=");
        if (equalIdx === -1) continue;
        const key = trimmed.slice(0, equalIdx).trim();
        const value = trimmed.slice(equalIdx + 1).trim();

        if (key === "t") {
            if (/^\d+$/.test(value)) {
                const parsed = parseInt(value, 10);
                if (!isNaN(parsed)) {
                    timestamp = parsed;
                }
            }
        } else if (key === "v1") {
            if (value) {
                signatures.push(value);
            }
        }
    }

    if (timestamp === null) {
        return {
            ok: false,
            reason: "malformed_header",
            errorMessage: "Malformed signature header: missing or non-numeric timestamp 't'",
        };
    }

    if (signatures.length === 0) {
        return {
            ok: false,
            reason: "malformed_header",
            errorMessage: "Malformed signature header: missing 'v1' signature",
        };
    }

    // Tolerance check
    const now = Math.floor(Date.now() / 1000);
    const diff = Math.abs(now - timestamp);
    if (diff > toleranceSeconds) {
        return {
            ok: false,
            reason: "timestamp_outside_tolerance",
            errorMessage: `Timestamp outside tolerance (${diff}s > ${toleranceSeconds}s)`,
        };
    }

    // Secret check
    if (typeof secret !== "string" || secret.trim() === "") {
        return {
            ok: false,
            reason: "no_matching_signature",
            errorMessage: "No webhook signing secret provided",
        };
    }

    // Compute expected HMAC over `${timestamp}.${rawBody}`
    const prefixBytes = new TextEncoder().encode(`${timestamp}.`);
    const payloadBytes = new Uint8Array(prefixBytes.length + bodyBytes.length);
    payloadBytes.set(prefixBytes, 0);
    payloadBytes.set(bodyBytes, prefixBytes.length);

    let key: CryptoKey;
    try {
        const secretBytes = new TextEncoder().encode(secret);
        key = await globalThis.crypto.subtle.importKey(
            "raw",
            secretBytes,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"]
        );
    } catch {
        return {
            ok: false,
            reason: "no_matching_signature",
            errorMessage: "Failed to import secret for HMAC verification",
        };
    }

    let matched = false;
    for (const sig of signatures) {
        if (sig.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(sig)) {
            continue;
        }
        const sigBytes = new Uint8Array(sig.length / 2);
        for (let i = 0; i < sigBytes.length; i++) {
            sigBytes[i] = parseInt(sig.substring(i * 2, i * 2 + 2), 16);
        }

        try {
            const isValid = await globalThis.crypto.subtle.verify(
                "HMAC",
                key,
                sigBytes,
                payloadBytes
            );
            if (isValid) {
                matched = true;
                break;
            }
        } catch {
            // Ignore single signature error and continue
        }
    }

    if (!matched) {
        return {
            ok: false,
            reason: "no_matching_signature",
            errorMessage: "No matching signature found for the provided secret",
        };
    }

    return {
        ok: true,
        bodyString,
    };
}

/**
 * Verifies the authenticity and timestamp of an incoming DEVUP AI webhook request signature.
 *
 * ⚠️ CRITICAL: `rawBody` MUST be the exact raw string or byte sequence (Buffer/Uint8Array) received
 * in the HTTP request before any JSON parsing. Re-serialising a parsed object alters formatting and
 * will cause verification to fail.
 *
 * @param params - Verification parameters including rawBody, signatureHeader, secret, and optional toleranceSeconds.
 * @returns A promise resolving to `true` if authentic and within tolerance, or `false` otherwise. Never throws on invalid signatures.
 */
export async function verifyWebhookSignature(params: VerifyWebhookSignatureParams): Promise<boolean> {
    try {
        const result = await verifyWebhookInternal(params);
        return result.ok;
    } catch {
        return false;
    }
}

/**
 * Verifies the authenticity of an incoming DEVUP AI webhook request, then parses and returns the typed event payload.
 *
 * ⚠️ CRITICAL: `rawBody` MUST be the exact raw string or byte sequence (Buffer/Uint8Array) received
 * in the HTTP request before any JSON parsing. Re-serialising a parsed object alters formatting and
 * will cause verification to fail.
 *
 * @param params - Verification parameters including rawBody, signatureHeader, secret, and optional toleranceSeconds.
 * @returns A promise resolving to the parsed and typed webhook event payload.
 * @throws {DevupWebhookVerificationError} If the header is malformed (`malformed_header`), timestamp is outside tolerance (`timestamp_outside_tolerance`), signature does not match (`no_matching_signature`), or body is not valid JSON (`invalid_json`).
 */
export async function constructWebhookEvent<T = WebhookEvent>(params: VerifyWebhookSignatureParams): Promise<T> {
    const result = await verifyWebhookInternal(params);
    if (!result.ok) {
        throw new DevupWebhookVerificationError(
            result.reason || "no_matching_signature",
            result.errorMessage || "Webhook signature verification failed"
        );
    }
    try {
        return JSON.parse(result.bodyString!) as T;
    } catch (jsonErr) {
        const message = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
        throw new DevupWebhookVerificationError(
            "invalid_json",
            `Failed to parse verified webhook payload as JSON: ${message}`,
            jsonErr
        );
    }
}

/**
 * Webhooks resource for verifying webhook signatures and constructing typed webhook events.
 */
export class Webhooks {
    /**
     * Verifies the authenticity and timestamp of an incoming DEVUP AI webhook request signature.
     *
     * ⚠️ CRITICAL: `rawBody` MUST be the exact raw string or byte sequence (Buffer/Uint8Array) received
     * in the HTTP request before any JSON parsing. Re-serialising a parsed object alters formatting and
     * will cause verification to fail.
     *
     * @param params - The verification parameters.
     * @returns A promise resolving to `true` if valid, `false` otherwise. Never throws.
     */
    verifySignature(params: VerifyWebhookSignatureParams): Promise<boolean> {
        return verifyWebhookSignature(params);
    }

    /**
     * Verifies the incoming webhook signature, parses the request body, and returns the typed event payload.
     *
     * ⚠️ CRITICAL: `rawBody` MUST be the exact raw string or byte sequence (Buffer/Uint8Array) received
     * in the HTTP request before any JSON parsing. Re-serialising a parsed object alters formatting and
     * will cause verification to fail.
     *
     * @param params - The verification parameters.
     * @returns A promise resolving to the typed webhook event payload.
     * @throws {DevupWebhookVerificationError} On verification failure or malformed JSON.
     */
    constructEvent<T = WebhookEvent>(params: VerifyWebhookSignatureParams): Promise<T> {
        return constructWebhookEvent<T>(params);
    }
}

/**
 * The main DEVUP AI client.
 * Provides access to all DEVUP AI API endpoints through a resource-based interface.
 */
class DevupAI {
    baseURL: string;
    /** Chat completions resource. */
    chat: Chat;
    /** Available models resource. */
    models: Models;
    /** Image generation and editing resource. */
    images: Images;
    /** Text embeddings resource. */
    embeddings: Embeddings;
    /** Audio speech and transcription resources. */
    audio: {
        speech: AudioSpeech;
        transcriptions: AudioTranscriptions;
    };
    /** Video generation and editing resources. */
    video: {
        generations: VideoGenerations;
        edits: VideoEdits;
    };
    /** Generic native inference resource. */
    inference: NativeInference;
    /** Document reranking resource. */
    rerank: Rerank;
    /** Account balance resource. */
    balance: Balance;
    /** API health check resource. */
    health: Health;
    /** Webhook verification and payload construction resource. */
    webhooks: Webhooks;

    constructor(options: DevUpAIOptions) {
        const baseURL = (options.baseURL || "https://api.devupai.com/v1").replace(/\/+$/, "");
        this.baseURL = baseURL;
        const apiKey = options.apiKey;
        const defaultHeaders = options.headers;
        this.chat = new Chat(apiKey, baseURL, defaultHeaders);
        this.models = new Models(apiKey, baseURL, defaultHeaders);
        this.images = new Images(apiKey, baseURL, defaultHeaders);
        this.embeddings = new Embeddings(apiKey, baseURL, defaultHeaders);
        this.rerank = new Rerank(apiKey, baseURL, defaultHeaders);
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
        this.webhooks = new Webhooks();
    }
}

export default DevupAI;
