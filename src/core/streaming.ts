import type { DebugEvent, StreamConfig } from "./client";
import { APIConnectionError, APITimeoutError, DevupAPIError, makeAPIError, parseWarnings } from "./errors";

/** One server-sent event. `event` is `null` when the event has no `event:` field. */
export interface ServerSentEvent {
    event: string | null;
    data: string;
}

/**
 * Incremental parser for `text/event-stream` content, following the WHATWG
 * HTML event-stream interpretation rules.
 */
export class SSEParser {
    #buffer = "";
    /** Characters of `#buffer` before this index were already scanned and contain no line break. */
    #scanned = 0;
    #pendingCR = false;
    #eventType: string | null = null;
    #data = "";
    #hasData = false;

    /** Adds decoded text and returns the events completed by it. */
    push(text: string): ServerSentEvent[] {
        const events: ServerSentEvent[] = [];
        let input = text;
        if (this.#pendingCR) {
            this.#pendingCR = false;
            if (input.startsWith("\n")) input = input.slice(1);
        }
        this.#buffer += input;
        let start = 0;
        // Only the new characters are scanned, so a long line split across many
        // chunks is not scanned again on every chunk.
        for (let i = this.#scanned; i < this.#buffer.length; i++) {
            const char = this.#buffer[i];
            if (char !== "\n" && char !== "\r") continue;
            const line = this.#buffer.slice(start, i);
            if (char === "\r") {
                if (i + 1 < this.#buffer.length) {
                    if (this.#buffer[i + 1] === "\n") i++;
                } else {
                    this.#pendingCR = true;
                }
            }
            start = i + 1;
            const event = this.#processLine(line);
            if (event) events.push(event);
        }
        this.#buffer = this.#buffer.slice(start);
        this.#scanned = this.#buffer.length;
        return events;
    }

    /**
     * Ends the input. Returns the data of an event that was not terminated by
     * a blank line (such an event is not dispatched), or `null`.
     */
    end(): string | null {
        if (this.#buffer.length > 0) {
            const line = this.#buffer;
            this.#buffer = "";
            this.#scanned = 0;
            this.#processLine(line);
        }
        const pending = this.#hasData ? this.#data : null;
        this.#data = "";
        this.#hasData = false;
        this.#eventType = null;
        return pending;
    }

    #processLine(line: string): ServerSentEvent | null {
        if (line === "") {
            if (!this.#hasData) {
                this.#eventType = null;
                return null;
            }
            const event: ServerSentEvent = { event: this.#eventType, data: this.#data };
            this.#eventType = null;
            this.#data = "";
            this.#hasData = false;
            return event;
        }
        if (line.startsWith(":")) return null;
        const colon = line.indexOf(":");
        let field: string;
        let value: string;
        if (colon === -1) {
            field = line;
            value = "";
        } else {
            field = line.slice(0, colon);
            value = line.slice(colon + 1);
            if (value.startsWith(" ")) value = value.slice(1);
        }
        if (field === "event") {
            this.#eventType = value;
        } else if (field === "data") {
            this.#data = this.#hasData ? `${this.#data}\n${value}` : value;
            this.#hasData = true;
        }
        return null;
    }
}

/** Options for a {@link Stream} beyond its {@link StreamConfig}. */
export interface StreamOptions {
    /** Receives frames that are not valid JSON. */
    onDebug?: (event: DebugEvent) => void;
    /** Ends the stream with an `APITimeoutError` when no bytes arrive for this many milliseconds. */
    idleTimeout?: number;
    /** The request's abort signal. When it has aborted, a read error is passed on unchanged. */
    signal?: AbortSignal;
}

/**
 * A server-sent event stream. Iterate it with `for await`; each item is one
 * parsed event. Leaving the loop early cancels the response body.
 */
export class Stream<T> implements AsyncIterable<T> {
    /** The HTTP response. */
    readonly response: Response;
    /** Value of the `x-request-id` response header. */
    readonly requestId: string | null;
    /** Informational notices from the `X-DEVUP-Warnings` response header. */
    readonly warnings: string[];

    readonly #config: StreamConfig;
    readonly #options: StreamOptions;
    #reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    #iterated = false;
    #aborted = false;

    constructor(response: Response, config: StreamConfig, options: StreamOptions = {}) {
        this.response = response;
        this.requestId = response.headers.get("x-request-id");
        this.warnings = parseWarnings(response.headers);
        this.#config = config;
        this.#options = options;
    }

    /** Stops the stream and cancels the response body. */
    abort(): void {
        if (this.#aborted) return;
        this.#aborted = true;
        const reader = this.#reader;
        const body = this.response.body;
        if (reader) {
            void cancelQuietly(() => reader.cancel());
        } else if (body && !body.locked) {
            void cancelQuietly(() => body.cancel());
        }
    }

    async *[Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
        if (this.#iterated) {
            throw new Error("A stream can be iterated only once.");
        }
        this.#iterated = true;
        const body = this.response.body;
        if (!body || this.#aborted) return;

        const reader = body.getReader();
        this.#reader = reader;
        const decoder = new TextDecoder("utf-8");
        const parser = new SSEParser();
        let bodyDone = false;
        try {
            while (true) {
                let chunk: ReadableStreamReadResult<Uint8Array>;
                try {
                    chunk = await this.#read(reader);
                } catch (error: unknown) {
                    throw this.#readError(error);
                }
                if (chunk.done) {
                    bodyDone = true;
                    const events = parser.push(decoder.decode());
                    for (const event of events) {
                        const outcome = this.#handle(event);
                        if (outcome === DONE) return;
                        if (outcome !== SKIP) yield outcome;
                    }
                    const pending = parser.end();
                    if (pending !== null && !this.#aborted) {
                        this.#debug({ type: "malformed_frame", detail: { data: pending } });
                    }
                    return;
                }
                const events = parser.push(decoder.decode(chunk.value, { stream: true }));
                for (const event of events) {
                    const outcome = this.#handle(event);
                    if (outcome === DONE) return;
                    if (outcome !== SKIP) yield outcome;
                }
            }
        } finally {
            if (!bodyDone) {
                await cancelQuietly(() => reader.cancel());
            }
            reader.releaseLock();
        }
    }

    #handle(event: ServerSentEvent): T | typeof DONE | typeof SKIP {
        if (event.data.trim() === "[DONE]") return DONE;
        let frame: unknown;
        try {
            frame = JSON.parse(event.data);
        } catch {
            this.#debug({ type: "malformed_frame", detail: { data: event.data } });
            return SKIP;
        }
        const error = this.#config.errorFrame(frame, event.event);
        if (error) {
            throw makeAPIError(
                this.response.status,
                error.message,
                { code: error.code, type: error.type, param: error.param },
                this.response.headers
            );
        }
        return frame as T;
    }

    /**
     * The error to throw when reading the body fails. An idle timeout (already an
     * `APITimeoutError`), a user abort and `abort()` are passed on unchanged; any
     * other read error becomes an `APIConnectionError`, so it is a `DevupAPIError`.
     */
    #readError(error: unknown): unknown {
        if (error instanceof DevupAPIError) return error;
        if (this.#aborted || this.#options.signal?.aborted) return error;
        return new APIConnectionError(
            0,
            `Network error: ${describeError(error)}`,
            undefined,
            this.response.headers,
            error
        );
    }

    #read(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<ReadableStreamReadResult<Uint8Array>> {
        const idle = this.#options.idleTimeout;
        if (idle === undefined || !(idle > 0) || !Number.isFinite(idle)) return reader.read();
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                const error = new APITimeoutError(
                    0,
                    `No data was received on the stream for ${idle} ms.`,
                    undefined,
                    this.response.headers
                );
                reject(error);
                void cancelQuietly(() => reader.cancel(error));
            }, idle);
            reader.read().then(
                (result) => {
                    clearTimeout(timer);
                    resolve(result);
                },
                (error: unknown) => {
                    clearTimeout(timer);
                    reject(error);
                }
            );
        });
    }

    /** Calls the `onDebug` hook. A hook that throws never changes the outcome of the stream. */
    #debug(event: DebugEvent): void {
        try {
            this.#options.onDebug?.(event);
        } catch {
            // Deliberately ignored: `onDebug` is a diagnostic hook, and its errors must not
            // end the stream or replace its result.
        }
    }
}

function describeError(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error) return error;
    return "unknown error";
}

const DONE: unique symbol = Symbol("done");
const SKIP: unique symbol = Symbol("skip");

/**
 * Cancels a body. `cancel()` rejects only when the body has already errored;
 * that error has already reached the caller through `read()`, so it is not
 * reported a second time.
 */
function cancelQuietly(cancel: () => Promise<void>): Promise<void> {
    return cancel().catch(() => undefined);
}
