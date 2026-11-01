/**
 * Test helpers: a recording `fetch` and response builders.
 *
 * Every mock records the method, URL, headers and body of each call so that
 * tests assert what the SDK sends, not only what it receives.
 */

export const TEST_KEY = "test_key";
export const BASE = "https://api.devupai.com/v1";
/** Synthetic request id in the `req_` + 32 hex format. */
export const REQ_ID = "req_0123456789abcdef0123456789abcdef";
export const REQ_ID_2 = "req_fedcba9876543210fedcba9876543210";
/** Synthetic model ids (never real ones: the repository is public). */
export const MODEL_A = "fixture/model-a";
export const MODEL_B = "fixture/model-b";

export interface RecordedRequest {
    url: string;
    method: string;
    headers: Headers;
    /** The raw `init.body` (string, FormData, ...). */
    body: unknown;
    /** `body` when it is a string, else null. */
    text: string | null;
    /** `body` parsed as JSON when it is a JSON string, else undefined. */
    json: unknown;
    /** `body` when it is a FormData, else null. */
    form: FormData | null;
    signal: AbortSignal | null;
}

export type Handler = (req: RecordedRequest, index: number) => Response | Promise<Response>;

export interface MockFetch {
    fetch: typeof fetch;
    calls: RecordedRequest[];
    last(): RecordedRequest;
}

function toUrl(input: RequestInfo | URL): string {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.href;
    return input.url;
}

function record(input: RequestInfo | URL, init: RequestInit | undefined): RecordedRequest {
    const isRequest = typeof input === "object" && !(input instanceof URL);
    const method = (init?.method ?? (isRequest ? (input as Request).method : "GET")).toUpperCase();
    const headers = new Headers(init?.headers ?? (isRequest ? (input as Request).headers : undefined));
    const body: unknown = init?.body ?? null;
    const text = typeof body === "string" ? body : null;
    let json: unknown = undefined;
    if (text !== null) {
        try {
            json = JSON.parse(text);
        } catch {
            json = undefined;
        }
    }
    const form = body instanceof FormData ? body : null;
    const signal = init?.signal ?? (isRequest ? (input as Request).signal : null);
    return { url: toUrl(input), method, headers, body, text, json, form, signal };
}

/** A `fetch` that records each call and answers through `handler`. */
export function mockFetch(handler: Handler): MockFetch {
    const calls: RecordedRequest[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const req = record(input, init);
        calls.push(req);
        return handler(req, calls.length - 1);
    };
    return {
        fetch: fetchImpl as typeof fetch,
        calls,
        last(): RecordedRequest {
            const req = calls[calls.length - 1];
            if (!req) throw new Error("fetch was not called");
            return req;
        },
    };
}

/** Answers each call with the next entry; the last entry repeats. */
export function sequence(...responses: Array<Response | (() => Response) | Error>): Handler {
    return (_req, index) => {
        const entry = responses[Math.min(index, responses.length - 1)];
        if (entry instanceof Error) throw entry;
        return typeof entry === "function" ? entry() : entry.clone();
    };
}

export function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json", "x-request-id": REQ_ID, ...init.headers },
    });
}

export function errorResponse(
    status: number,
    code: string,
    message = "The request could not be completed.",
    headers: Record<string, string> = {},
    param?: string | null,
): Response {
    const error: Record<string, unknown> = { message, type: "devup_error", code };
    if (param !== undefined) error.param = param;
    return jsonResponse({ error }, { status, headers });
}

const encoder = new TextEncoder();

export interface SSEOptions {
    headers?: Record<string, string>;
    /** Delay before each piece, in ms (real timers). */
    delayMs?: number;
    /** Do not close the body after the last piece (it stays open until cancelled). */
    keepOpen?: boolean;
    /** Error the body after the last piece. */
    errorAfter?: Error;
    /** Called when the consumer cancels the body. */
    onCancel?: (reason: unknown) => void;
}

/** A `text/event-stream` response whose body delivers `pieces` (strings or raw bytes) in order. */
export function sseResponse(pieces: Array<string | Uint8Array>, options: SSEOptions = {}): Response {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let i = 0;
    const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
            return new Promise<void>((resolve) => {
                const step = () => {
                    if (i < pieces.length) {
                        const piece = pieces[i++]!;
                        controller.enqueue(typeof piece === "string" ? encoder.encode(piece) : piece);
                        resolve();
                        return;
                    }
                    if (options.errorAfter) {
                        controller.error(options.errorAfter);
                    } else if (!options.keepOpen) {
                        controller.close();
                    }
                    resolve();
                };
                if (options.delayMs && i < pieces.length) {
                    timer = setTimeout(step, options.delayMs);
                } else {
                    step();
                }
            });
        },
        cancel(reason) {
            if (timer) clearTimeout(timer);
            options.onCancel?.(reason);
        },
    });
    return new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream", "x-request-id": REQ_ID, ...options.headers },
    });
}

/** One SSE `data:` event for a JSON value. */
export function dataEvent(value: unknown): string {
    return `data: ${JSON.stringify(value)}\n\n`;
}

export const DONE = "data: [DONE]\n\n";

/** The chunk shape of a chat completion stream. */
export function chunk(fields: Record<string, unknown>): Record<string, unknown> {
    return {
        id: "chatcmpl-00000000-0000-4000-8000-000000000000",
        object: "chat.completion.chunk",
        created: 1700000000,
        model: MODEL_A,
        ...fields,
    };
}

export const USAGE = {
    prompt_tokens: 10,
    completion_tokens: 2,
    total_tokens: 12,
    prompt_tokens_details: { cached_tokens: 0 },
    completion_tokens_details: { reasoning_tokens: 0 },
};

/** A stream of the real shape: role chunk, content, finish, final `choices: []` chunk with `usage`, `[DONE]`. */
export function realChatStream(): string[] {
    return [
        dataEvent(chunk({ service_tier: null, choices: [{ index: 0, delta: { role: "assistant", content: "" }, logprobs: null, finish_reason: null }] })),
        dataEvent(chunk({ service_tier: "default", choices: [{ index: 0, delta: { content: "Hello" }, logprobs: null, finish_reason: null }] })),
        dataEvent(chunk({ service_tier: "default", choices: [{ index: 0, delta: { content: " world" }, logprobs: null, finish_reason: "stop" }] })),
        dataEvent(chunk({ service_tier: "default", choices: [], usage: USAGE })),
        DONE,
    ];
}

/** A `fetch` handler that never answers until the request signal aborts (then rejects with its reason). */
export function hangUntilAborted(req: RecordedRequest): Promise<Response> {
    return new Promise<Response>((_resolve, reject) => {
        const signal = req.signal;
        if (!signal) return; // never answers: the test fails by its own timeout
        if (signal.aborted) {
            reject(signal.reason);
            return;
        }
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
}

/** Header names of a recorded request, lower-cased. */
export function headerNames(req: RecordedRequest): string[] {
    const names: string[] = [];
    req.headers.forEach((_value, key) => names.push(key.toLowerCase()));
    return names;
}
