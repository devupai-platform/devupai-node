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
    /** Value of the `x-client-request-id` response header. */
    readonly clientRequestId: string | null;
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
        this.clientRequestId = this.headers["x-client-request-id"] || null;
        this.retryAfter = this.headers["retry-after"] || null;
        this.retryAfterMs = headers ? parseRetryAfterMs(headers) : null;
        this.warnings = headers ? parseWarnings(headers) : [];
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** HTTP 400: the request is not valid as sent. `code` and `param` name the reason and the field. */
export class BadRequestError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "BadRequestError";
    }
}

/** HTTP 401: the API key is missing or not valid. */
export class AuthenticationError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "AuthenticationError";
    }
}

/**
 * HTTP 402: the account balance (`code` `insufficient_balance`), or the budget of a scoped
 * credential (`budget_exhausted`), does not cover the request.
 */
export class PaymentRequiredError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "PaymentRequiredError";
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

/**
 * HTTP 409: the outcome of this request is not confirmed yet (`request_outcome_pending`).
 * Do not send it again: contact support with `requestId`.
 */
export class ConflictError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "ConflictError";
    }
}

/** HTTP 413: the request body is larger than the endpoint takes. Send a smaller body. */
export class PayloadTooLargeError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "PayloadTooLargeError";
    }
}

/**
 * HTTP 415: the model does not accept the content type of the request. Check the `Content-Type` header and the
 * body format against the API reference.
 */
export class UnsupportedMediaTypeError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "UnsupportedMediaTypeError";
    }
}

/** HTTP 422: the request is well formed, but a value in it cannot be processed. `code` and `param` name it. */
export class UnprocessableEntityError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "UnprocessableEntityError";
    }
}

/** HTTP 429: too many requests. `retryAfterMs` gives the wait, when present. */
export class RateLimitError extends DevupAPIError {
    constructor(...args: ConstructorParameters<typeof DevupAPIError>) {
        super(...args);
        this.name = "RateLimitError";
    }
}

/**
 * HTTP 500 or above. After a 500 or 502 (`server_error`, `DEVUP_COMPUTE_ERROR`) the request may already have
 * been processed and billed: check its outcome before sending it again.
 */
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
    if (status === 400) return new BadRequestError(status, message, errorData, headers);
    if (status === 401) return new AuthenticationError(status, message, errorData, headers);
    if (status === 402) return new PaymentRequiredError(status, message, errorData, headers);
    if (status === 403) return new PermissionDeniedError(status, message, errorData, headers);
    if (status === 404) return new NotFoundError(status, message, errorData, headers);
    if (status === 409) return new ConflictError(status, message, errorData, headers);
    if (status === 413) return new PayloadTooLargeError(status, message, errorData, headers);
    if (status === 415) return new UnsupportedMediaTypeError(status, message, errorData, headers);
    if (status === 422) return new UnprocessableEntityError(status, message, errorData, headers);
    if (status === 429) return new RateLimitError(status, message, errorData, headers);
    if (status >= 500) return new InternalServerError(status, message, errorData, headers);
    return new DevupAPIError(status, message, errorData, headers);
}
