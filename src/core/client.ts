import { APIPromise, type WithResponse } from "./api-promise";
import {
    APIConnectionError,
    APITimeoutError,
    DevupAPIError,
    makeAPIError,
    parseWarnings,
    type APIErrorData,
} from "./errors";
import { Stream } from "./streaming";
import { VERSION } from "./version";

/** An event passed to the `onDebug` client option. */
export interface DebugEvent {
    /** `malformed_frame`: a stream frame that is not valid JSON was skipped. `retry`: the request is sent again. */
    type: "malformed_frame" | "retry";
    /** `{ data }` for `malformed_frame`; `{ attempt, status, waitMs }` for `retry` (`status` is `0` when no response was received). */
    detail: Record<string, unknown>;
}

/** Options of the API client. */
export interface ClientOptions {
    /** Your DEVUP AI API key. */
    apiKey: string;
    /** Base URL of the API. Defaults to `https://api.devupai.com/v1`. A trailing `/` is removed. */
    baseURL?: string;
    /** Headers sent with every request. */
    headers?: Record<string, string>;
    /** How many times a request is sent again after a transient error. Defaults to `2`. */
    maxRetries?: number;
    /** Timeout of a request in milliseconds. Defaults to `600000` (10 minutes). For streams it covers the time until the response headers arrive. */
    timeout?: number;
    /** Ends a stream with an `APITimeoutError` when no data arrives for this many milliseconds. Off by default. */
    streamIdleTimeout?: number;
    /** A `fetch` implementation to use instead of the global one. */
    fetch?: typeof fetch;
    /** Receives diagnostic events: skipped stream frames and retries. */
    onDebug?: (event: DebugEvent) => void;
}

/** Options of one request. Values given here override the client options. */
export interface RequestOptions {
    /** Abort signal to cancel the request. */
    signal?: AbortSignal | null;
    /** Timeout of the request in milliseconds. */
    timeout?: number;
    /** How many times the request is sent again after a transient error. */
    maxRetries?: number;
    /** Headers to send with the request. */
    headers?: Record<string, string>;
    /** Ends a stream with an `APITimeoutError` when no data arrives for this many milliseconds. */
    streamIdleTimeout?: number;
}

/** The keys of {@link RequestOptions}. */
export const REQUEST_OPTION_KEYS = ["signal", "timeout", "maxRetries", "headers", "streamIdleTimeout"] as const;

/**
 * Separates request options that were passed inside the request parameters
 * from the request body. Keys whose value is `undefined` are left out of the options.
 */
export function splitRequestOptions<T extends object>(params: T): {
    body: Omit<T, keyof RequestOptions>;
    options: RequestOptions;
} {
    const body: Record<string, unknown> = {};
    const options: Record<string, unknown> = {};
    const optionKeys: readonly string[] = REQUEST_OPTION_KEYS;
    for (const [key, value] of Object.entries(params ?? {})) {
        if (optionKeys.includes(key)) {
            if (value !== undefined) options[key] = value;
        } else {
            body[key] = value;
        }
    }
    return { body: body as Omit<T, keyof RequestOptions>, options: options as RequestOptions };
}

/** A request sent by {@link APIClient}. */
export interface APIRequest {
    method: "GET" | "POST";
    /** Path appended to the base URL. Starts with `/`. */
    path?: string;
    /** Absolute URL, used instead of `path`. */
    url?: string;
    /** Query parameters. `undefined` values are left out. */
    query?: Record<string, string | undefined>;
    /** A value sent as JSON, or a `FormData` sent as is. */
    body?: unknown;
    /** `true` sends `Authorization: Bearer <apiKey>`; `false` sends no `Authorization` header. */
    auth: boolean;
    options?: RequestOptions;
}

/** How a stream recognises an error frame. */
export interface StreamConfig {
    /** Returns the error carried by a frame, or `null` when the frame is not an error. */
    errorFrame: (frame: unknown, event: string | null) => {
        message: string;
        code?: string;
        type?: string;
        param?: string | null;
    } | null;
}

const DEFAULT_BASE_URL = "https://api.devupai.com/v1";
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 600_000;
const MAX_TIMER_MS = 2_147_483_647;
const RETRY_STATUSES: ReadonlySet<number> = new Set([408, 429, 502, 503, 504]);
const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 60_000;

type ResponseKind = "json" | "text" | "raw" | "stream";

function normalizeMaxRetries(value: unknown, defaultValue: number): number {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        throw new TypeError("maxRetries must be a non-negative integer.");
    }
    return value;
}

function normalizeTimeout(value: unknown, defaultValue: number): number {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
        throw new TypeError("timeout must be a positive number of milliseconds.");
    }
    return Math.min(value, MAX_TIMER_MS);
}

/** `0` turns the idle timeout off. */
function normalizeIdleTimeout(value: unknown, defaultValue: number | undefined): number | undefined {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
        throw new TypeError("streamIdleTimeout must be a non-negative number of milliseconds.");
    }
    return value === 0 ? undefined : Math.min(value, MAX_TIMER_MS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function setHeader(headers: Record<string, string>, name: string, value: string): void {
    deleteHeader(headers, name);
    headers[name] = value;
}

function deleteHeader(headers: Record<string, string>, name: string): void {
    const lower = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower) delete headers[key];
    }
}

function mergeHeaders(target: Record<string, string>, source: Record<string, string> | undefined): void {
    if (!source) return;
    for (const [name, value] of Object.entries(source)) {
        if (typeof value === "string") setHeader(target, name, value);
    }
}

/** CR, LF and NUL: characters that are never allowed in an HTTP header value. */
const FORBIDDEN_HEADER_CHARS = /[\r\n\0]/;

/**
 * Checks every header name and value before a request is sent. The error names
 * the header but never contains its value, so a credential never reaches a log.
 */
function validateHeaders(headers: Record<string, string>): void {
    for (const [name, value] of Object.entries(headers)) {
        try {
            new Headers([[name, ""]]);
        } catch {
            // The platform's own message would repeat the invalid name.
            throw new TypeError("A header name contains characters that are not allowed in an HTTP header.");
        }
        let valid = !FORBIDDEN_HEADER_CHARS.test(value);
        if (valid) {
            try {
                new Headers([[name, value]]);
            } catch {
                // The platform's own message would repeat the value.
                valid = false;
            }
        }
        if (!valid) {
            throw new TypeError(`Header "${name}" has a value that is not allowed in an HTTP header.`);
        }
    }
}

function describeError(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error) return error;
    return "unknown error";
}

/** Rejects with `onAbort()` as soon as `signal` aborts. The listener is removed when `promise` completes. */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal, onAbort: () => unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const listener = (): void => reject(onAbort());
        if (signal.aborted) {
            listener();
        } else {
            signal.addEventListener("abort", listener, { once: true });
        }
        promise.then(
            (value) => {
                signal.removeEventListener("abort", listener);
                resolve(value);
            },
            (error: unknown) => {
                signal.removeEventListener("abort", listener);
                reject(error);
            }
        );
    });
}

/** Waits `ms` milliseconds, or rejects with `onAbort()` when `signal` aborts first. */
function sleep(ms: number, signal: AbortSignal, onAbort: () => unknown): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
            reject(onAbort());
            return;
        }
        const listener = (): void => {
            clearTimeout(timer);
            reject(onAbort());
        };
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", listener);
            resolve();
        }, ms);
        signal.addEventListener("abort", listener, { once: true });
    });
}

function errorFromBody(status: number, text: string, headers: Headers): DevupAPIError {
    let message = "";
    let data: APIErrorData | undefined;
    if (text) {
        message = text;
        try {
            const parsed: unknown = JSON.parse(text);
            if (isRecord(parsed) && isRecord(parsed.error)) {
                const error = parsed.error;
                if (typeof error.message === "string" && error.message) message = error.message;
                data = {
                    type: typeof error.type === "string" ? error.type : undefined,
                    code: typeof error.code === "string"
                        ? error.code
                        : typeof error.code === "number" ? String(error.code) : undefined,
                    param: typeof error.param === "string" ? error.param : null,
                };
            } else if (isRecord(parsed) && typeof parsed.error === "string" && parsed.error) {
                message = parsed.error;
            }
        } catch {
            // Not JSON: the raw text is the message.
        }
    }
    if (!message.trim()) message = `HTTP ${status}`;
    return makeAPIError(status, message, data, headers);
}

/**
 * Sends requests to the DEVUP AI API: headers, retries, timeouts, errors and
 * response parsing. Resource classes build on it.
 */
export class APIClient {
    readonly baseURL: string;
    readonly apiKey: string;
    readonly maxRetries: number;
    readonly timeout: number;
    readonly streamIdleTimeout: number | undefined;

    readonly #headers: Record<string, string>;
    readonly #fetch: typeof fetch | undefined;
    readonly #onDebug: ((event: DebugEvent) => void) | undefined;

    constructor(options: ClientOptions) {
        if (!isRecord(options)) {
            throw new TypeError("Client options are required.");
        }
        // An empty key stays allowed: `health.check()` sends no key. The message never contains the key.
        if (typeof options.apiKey === "string" && FORBIDDEN_HEADER_CHARS.test(options.apiKey)) {
            throw new TypeError("apiKey contains characters that are not allowed in an HTTP header.");
        }
        this.apiKey = options.apiKey;
        this.baseURL = (options.baseURL || DEFAULT_BASE_URL).replace(/\/+$/, "");
        this.maxRetries = normalizeMaxRetries(options.maxRetries, DEFAULT_MAX_RETRIES);
        this.timeout = normalizeTimeout(options.timeout, DEFAULT_TIMEOUT_MS);
        this.streamIdleTimeout = normalizeIdleTimeout(options.streamIdleTimeout, undefined);
        this.#headers = { ...options.headers };
        this.#fetch = options.fetch;
        this.#onDebug = options.onDebug;
    }

    /** Sends the request and parses the response body as JSON. The timeout covers the whole call. */
    json<T>(req: APIRequest): APIPromise<T> {
        return new APIPromise<T>(this.#execute<T>(req, "json"));
    }

    /** Sends the request and returns the response body as text. The timeout covers the whole call. */
    text(req: APIRequest): APIPromise<string> {
        return new APIPromise<string>(this.#execute<string>(req, "text"));
    }

    /** Sends the request and returns the `Response` with its body unread. The timeout covers the time until the response headers arrive. */
    raw(req: APIRequest): APIPromise<Response> {
        return new APIPromise<Response>(this.#execute<Response>(req, "raw"));
    }

    /** Sends the request and returns a {@link Stream} of server-sent events. The timeout covers the time until the response headers arrive. */
    stream<T>(req: APIRequest, config: StreamConfig): APIPromise<Stream<T>> {
        return new APIPromise<Stream<T>>(this.#execute<Stream<T>>(req, "stream", config));
    }

    async #execute<R>(req: APIRequest, kind: ResponseKind, config?: StreamConfig): Promise<WithResponse<R>> {
        const options = req.options ?? {};
        const userSignal = options.signal ?? undefined;
        if (userSignal?.aborted) throw userSignal.reason;

        const timeoutMs = normalizeTimeout(options.timeout, this.timeout);
        const maxRetries = normalizeMaxRetries(options.maxRetries, this.maxRetries);
        const idleTimeout = normalizeIdleTimeout(options.streamIdleTimeout, this.streamIdleTimeout);
        const url = this.#buildURL(req);
        const isFormData = typeof FormData !== "undefined" && req.body instanceof FormData;
        const body: BodyInit | undefined = req.body === undefined
            ? undefined
            : isFormData ? (req.body as FormData) : JSON.stringify(req.body);
        const headers = this.#buildHeaders(req, kind, body !== undefined && !isFormData);
        // Invalid header names or values throw here, before any request is sent (never retried).
        validateHeaders(headers);
        const fetchImpl = this.#fetch ?? globalThis.fetch;

        const deadline = Date.now() + timeoutMs;
        const timeoutController = new AbortController();
        const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
        const signal = userSignal
            ? AbortSignal.any([userSignal, timeoutController.signal])
            : timeoutController.signal;
        const abortError = (): unknown =>
            userSignal?.aborted
                ? userSignal.reason
                : new APITimeoutError(0, `The request timed out after ${timeoutMs} ms.`);

        try {
            for (let attempt = 0; ; attempt++) {
                if (signal.aborted) throw abortError();

                let response: Response;
                try {
                    response = await raceAbort(
                        fetchImpl(url, { method: req.method, headers, body, signal }),
                        signal,
                        abortError
                    );
                } catch (error: unknown) {
                    if (signal.aborted) throw abortError();
                    const connectionError = new APIConnectionError(
                        0,
                        `Network error: ${describeError(error)}`,
                        undefined,
                        undefined,
                        error
                    );
                    const waitMs = attempt < maxRetries ? this.#retryWait(null, attempt, deadline) : null;
                    if (waitMs === null) throw connectionError;
                    this.#debug({ type: "retry", detail: { attempt: attempt + 1, status: 0, waitMs } });
                    await sleep(waitMs, signal, abortError);
                    continue;
                }

                if (!response.ok) {
                    let text = "";
                    try {
                        text = await raceAbort(response.text(), signal, abortError);
                    } catch {
                        if (signal.aborted) throw abortError();
                        // The body could not be read: the message falls back to the HTTP status.
                    }
                    const error = errorFromBody(response.status, text, response.headers);
                    if (attempt < maxRetries && RETRY_STATUSES.has(response.status)) {
                        const waitMs = this.#retryWait(error.retryAfterMs, attempt, deadline);
                        if (waitMs !== null) {
                            this.#debug({
                                type: "retry",
                                detail: { attempt: attempt + 1, status: response.status, waitMs },
                            });
                            await sleep(waitMs, signal, abortError);
                            continue;
                        }
                    }
                    throw error;
                }

                if (kind === "raw" || kind === "stream") clearTimeout(timer);
                const data = await this.#readBody<R>(response, kind, signal, abortError, config, idleTimeout);
                return {
                    data,
                    response,
                    requestId: response.headers.get("x-request-id"),
                    warnings: parseWarnings(response.headers),
                };
            }
        } finally {
            clearTimeout(timer);
        }
    }

    async #readBody<R>(
        response: Response,
        kind: ResponseKind,
        signal: AbortSignal,
        abortError: () => unknown,
        config: StreamConfig | undefined,
        idleTimeout: number | undefined
    ): Promise<R> {
        if (kind === "raw") return response as R;
        if (kind === "stream") {
            if (!response.body || !config) {
                throw new DevupAPIError(response.status, "The response has no body.", undefined, response.headers);
            }
            return new Stream<unknown>(response, config, { onDebug: this.#onDebug, idleTimeout, signal }) as R;
        }
        let text: string;
        try {
            text = await raceAbort(response.text(), signal, abortError);
        } catch (error: unknown) {
            if (signal.aborted) throw abortError();
            throw new APIConnectionError(
                0,
                `Network error: ${describeError(error)}`,
                undefined,
                response.headers,
                error
            );
        }
        if (kind === "text") return text as R;
        try {
            return JSON.parse(text) as R;
        } catch (error: unknown) {
            throw new DevupAPIError(
                response.status,
                "The response body is not valid JSON.",
                undefined,
                response.headers,
                error
            );
        }
    }

    /** The wait before the next attempt, or `null` when there is no time left for it. */
    #retryWait(serverWaitMs: number | null, attempt: number, deadline: number): number | null {
        const remaining = deadline - Date.now();
        const waitMs = serverWaitMs !== null
            ? serverWaitMs
            : Math.random() * Math.min(MAX_RETRY_DELAY_MS, INITIAL_RETRY_DELAY_MS * 2 ** attempt);
        if (waitMs > remaining) return null;
        return Math.round(waitMs);
    }

    #buildURL(req: APIRequest): string {
        let base: string;
        if (req.url !== undefined) {
            base = req.url;
        } else if (req.path !== undefined) {
            base = `${this.baseURL}${req.path}`;
        } else {
            throw new TypeError("A request needs a path or a url.");
        }
        const url = new URL(base);
        const query = Object.entries(req.query ?? {}).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string"
        );
        if (query.length === 0) return base;
        for (const [name, value] of query) url.searchParams.set(name, value);
        return url.toString();
    }

    #buildHeaders(req: APIRequest, kind: ResponseKind, jsonBody: boolean): Record<string, string> {
        const headers: Record<string, string> = {
            Accept: kind === "json" ? "application/json" : kind === "stream" ? "text/event-stream" : "*/*",
            "User-Agent": `devupai-node/${VERSION}`,
        };
        mergeHeaders(headers, this.#headers);
        mergeHeaders(headers, req.options?.headers);
        deleteHeader(headers, "authorization");
        deleteHeader(headers, "content-type");
        if (req.auth) headers["Authorization"] = `Bearer ${this.apiKey}`;
        if (jsonBody) headers["Content-Type"] = "application/json";
        return headers;
    }

    /** Calls the `onDebug` hook. A hook that throws never changes the outcome of the request. */
    #debug(event: DebugEvent): void {
        try {
            this.#onDebug?.(event);
        } catch {
            // Deliberately ignored: `onDebug` is a diagnostic hook, and its errors must not
            // turn a successful request (or a retry) into a failure.
        }
    }
}
