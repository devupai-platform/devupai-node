/** Fields of the `error` object in an API error response. */
export interface APIErrorData {
    type?: string;
    code?: string;
    param?: string | null;
}

function toOptionalString(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return undefined;
}

function headersToRecord(headers: Headers | undefined): Record<string, string> {
    const record: Record<string, string> = {};
    if (headers) {
        headers.forEach((value, key) => {
            record[key.toLowerCase()] = value;
        });
    }
    return record;
}

/**
 * Reads the wait requested by the API before a new attempt, in milliseconds.
 * Uses `retry-after-ms` first, then `Retry-After` (seconds or an HTTP date).
 * Returns `null` when neither header contains a usable value.
 */
export function parseRetryAfterMs(headers: Headers, now: number = Date.now()): number | null {
    const ms = headers.get("retry-after-ms");
    if (ms !== null && ms.trim() !== "") {
        const value = Number(ms.trim());
        if (Number.isFinite(value) && value >= 0) return value;
    }
    const retryAfter = headers.get("retry-after");
    if (retryAfter === null) return null;
    const trimmed = retryAfter.trim();
    if (trimmed === "") return null;
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
        return Number(trimmed) * 1000;
    }
    const date = Date.parse(trimmed);
    if (Number.isFinite(date)) return Math.max(0, date - now);
    return null;
}

/**
 * Parses the `X-DEVUP-Warnings` header: informational notices about how the
 * request was handled. Returns an empty array when the header is absent.
 */
export function parseWarnings(headers: Headers): string[] {
    const raw = headers.get("x-devup-warnings");
    if (!raw) return [];
    return raw
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

/**
 * Error thrown by the DEVUP AI API client.
 *
 * `status` is the HTTP status, or `0` when no response was received
 * (connection error or timeout).
 */
export class DevupAPIError extends Error {
    /** HTTP status, or `0` when no response was received. */
    readonly status: number;
    /** Error type from the response body, when present. */
    readonly type: string | undefined;
    /** Error code from the response body, when present. */
    readonly code: string | undefined;
    /** Request parameter the error refers to, when present. */
    readonly param: string | null;
    /** Value of the `x-request-id` response header. */
    readonly requestId: string | null;
    /** Raw value of the `Retry-After` response header. */
    readonly retryAfter: string | null;
    /** Wait requested by the API before a new attempt, in milliseconds. */
    readonly retryAfterMs: number | null;
    /** Informational notices from the `X-DEVUP-Warnings` response header. */
    readonly warnings: string[];
    /** Response headers, with lower-cased names. */
    readonly headers: Record<string, string>;
    /** Underlying error, when there is one. */
    override readonly cause: unknown;

    constructor(
        status: number,
        message: string,
        errorData?: APIErrorData,
        headers?: Headers,
        cause?: unknown
    ) {
        super(message);
        this.name = "DevupAPIError";
        this.status = status;
        this.type = toOptionalString(errorData?.type);
        this.code = toOptionalString(errorData?.code);
        this.param = typeof errorData?.param === "string" ? errorData.param : null;
        this.cause = cause;
        this.headers = headersToRecord(headers);
        this.requestId = this.headers["x-request-id"] || null;
        this.retryAfter = this.headers["retry-after"] || null;
        this.retryAfterMs = headers ? parseRetryAfterMs(headers) : null;
        this.warnings = headers ? parseWarnings(headers) : [];
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** HTTP 401: the API key is missing or not valid. */
export class AuthenticationError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "AuthenticationError";
    }
}

/** HTTP 403: the API key is not permitted to perform this request. */
export class PermissionDeniedError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "PermissionDeniedError";
    }
}

/** HTTP 404: the requested resource does not exist. */
export class NotFoundError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "NotFoundError";
    }
}

/** HTTP 409: the request could not be completed. Retry later or contact support. */
export class ConflictError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "ConflictError";
    }
}

/** HTTP 429: too many requests. `retryAfterMs` gives the wait, when present. */
export class RateLimitError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "RateLimitError";
    }
}

/** HTTP 500 or above: the request could not be completed. Retry later or contact support. */
export class InternalServerError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "InternalServerError";
    }
}

/** No response was received from the API (`status` is `0`). */
export class APIConnectionError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "APIConnectionError";
    }
}

/** The request did not complete within its timeout (`status` is `0`). */
export class APITimeoutError extends APIConnectionError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "APITimeoutError";
    }
}

/**
 * Creates the error for an HTTP status, using the matching subclass of
 * {@link DevupAPIError}.
 */
export function makeAPIError(
    status: number,
    message: string,
    errorData: APIErrorData | undefined,
    headers: Headers | undefined
): DevupAPIError {
    if (status === 401) return new AuthenticationError(status, message, errorData, headers);
    if (status === 403) return new PermissionDeniedError(status, message, errorData, headers);
    if (status === 404) return new NotFoundError(status, message, errorData, headers);
    if (status === 409) return new ConflictError(status, message, errorData, headers);
    if (status === 429) return new RateLimitError(status, message, errorData, headers);
    if (status >= 500) return new InternalServerError(status, message, errorData, headers);
    return new DevupAPIError(status, message, errorData, headers);
}
