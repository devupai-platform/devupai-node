import { APIPromise } from "../core/api-promise";
import { splitRequestOptions, type APIClient, type RequestOptions } from "../core/client";

/** Base class of every resource: keeps a reference to the shared HTTP client. */
export abstract class APIResource {
    protected readonly _client: APIClient;

    constructor(client: APIClient) {
        this._client = client;
    }
}

/** Binary input accepted by the multipart methods. */
export type BinaryInput = Blob | File | Uint8Array;

/** Copies only the request options that are set, so `undefined` never overrides a value. */
function definedOptions(source: RequestOptions | undefined): RequestOptions {
    const out: RequestOptions = {};
    if (!source) return out;
    if (source.signal !== undefined) out.signal = source.signal;
    if (source.timeout !== undefined) out.timeout = source.timeout;
    if (source.maxRetries !== undefined) out.maxRetries = source.maxRetries;
    if (source.headers !== undefined) out.headers = source.headers;
    if (source.streamIdleTimeout !== undefined) out.streamIdleTimeout = source.streamIdleTimeout;
    return out;
}

/** Merges two header records; names compare case-insensitively and `second` wins. */
function mergeHeaders(first: Record<string, string>, second: Record<string, string>): Record<string, string> {
    const merged: Record<string, string> = { ...first };
    for (const name of Object.keys(second)) {
        const lower = name.toLowerCase();
        for (const existing of Object.keys(merged)) {
            if (existing.toLowerCase() === lower) delete merged[existing];
        }
        merged[name] = second[name];
    }
    return merged;
}

/**
 * Merges request options given inside the params (3.x style) with the ones given
 * as the second argument. The second argument wins; headers are merged per name.
 */
export function mergeRequestOptions(first: RequestOptions | undefined, second: RequestOptions | undefined): RequestOptions {
    const a = definedOptions(first);
    const b = definedOptions(second);
    const merged: RequestOptions = { ...a, ...b };
    if (a.headers && b.headers) merged.headers = mergeHeaders(a.headers, b.headers);
    return merged;
}

/**
 * Splits the request options out of `params` and merges them with `options`.
 * Returns the request body (params without the request options) and the final options.
 */
export function prepareRequest<T extends object>(
    params: T,
    options: RequestOptions | undefined,
): { body: Omit<T, keyof RequestOptions>; options: RequestOptions } {
    const split = splitRequestOptions(params);
    return { body: split.body, options: mergeRequestOptions(split.options, options) };
}

/** Wraps a `Uint8Array` in a `Blob` so it can be appended to a `FormData`. */
export function toBlob(value: BinaryInput): Blob {
    if (value instanceof Uint8Array) {
        // A Uint8Array is a valid BlobPart at runtime; the cast only bridges the
        // ArrayBufferLike / ArrayBuffer distinction of recent DOM typings.
        return new Blob([value as Uint8Array<ArrayBuffer>]);
    }
    return value;
}

/** Appends a scalar form field when the value is set (`undefined` and `null` are skipped). */
export function appendField(form: FormData, name: string, value: string | number | boolean | null | undefined): void {
    if (value === undefined || value === null) return;
    form.append(name, String(value));
}

/** Narrowing helper: a plain JSON object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns the value when it is a string, otherwise `undefined`. */
export function stringOrUndefined(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

/**
 * An {@link APIPromise} that rejects with `error` without sending a request
 * (used for input the SDK refuses before any network call).
 */
export function rejectedAPIPromise<T>(error: unknown): APIPromise<T> {
    return new APIPromise<T>(Promise.reject(error));
}

/** Message used when an error event carries no message of its own. */
export const DEFAULT_STREAM_ERROR_MESSAGE = "The request could not be completed.";
