/**
 * Token usage reported in a webhook delivery.
 */
export interface WebhookUsage {
    /** Number of prompt tokens. */
    prompt_tokens: number;
    /** Number of completion tokens. */
    completion_tokens: number;
}

/**
 * Webhook delivery sent when an asynchronous request completes.
 */
export interface WebhookSuccessPayload {
    /** Webhook delivery identifier (`whd_<uuid>`). */
    id: string;
    /** Status of the request. */
    status: "succeeded";
    /** Token usage of the request. */
    usage: WebhookUsage;
    /** Final cost of the request in DZD. */
    cost_dzd: number;
    /** Status of the charge. */
    settlement: "settled";
    /** Results returned by the model. */
    results: Array<Record<string, unknown>>;
}

/**
 * Details of the error that ended an asynchronous request.
 */
export interface WebhookErrorDetails {
    /** Error type. */
    type: string;
    /** Human-readable description of the error. */
    message: string;
}

/**
 * Webhook delivery sent when an asynchronous request ends with an error.
 */
export interface WebhookErrorPayload {
    /** Webhook delivery identifier (`whd_<uuid>`). */
    id: string;
    /** Status of the request. */
    status: "failed";
    /** Token usage of the request (zero when the request ended with an error). */
    usage: WebhookUsage;
    /** Cost of the request in DZD (`null` when the request ended with an error). */
    cost_dzd: null;
    /** Status of the charge. */
    settlement: "failed";
    /** Type and message of the error. */
    error: WebhookErrorDetails;
}

/**
 * Webhook delivery payload: either the results of the request or the details of its error.
 */
export type WebhookEvent = WebhookSuccessPayload | WebhookErrorPayload;

/**
 * Reasons a webhook signature check or payload construction can be rejected.
 */
export type DevupWebhookVerificationErrorReason =
    | "malformed_header"
    | "timestamp_outside_tolerance"
    | "no_matching_signature"
    | "invalid_json";

/**
 * Error thrown when a webhook payload cannot be verified or parsed.
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
 * Parameters for verifying the signature of an incoming DEVUP AI webhook request.
 */
export interface VerifyWebhookSignatureParams {
    /**
     * The raw, unparsed HTTP request body (string or Uint8Array).
     *
     * Important: `rawBody` must be the exact string or byte sequence received in the HTTP request.
     * Re-serialising a parsed JSON object changes whitespace and key order, and the signature no longer matches.
     */
    rawBody: string | Uint8Array;
    /**
     * The `X-DevUp-Signature` HTTP header value:
     * `t=<unix_timestamp>,v1=<hex_signature>[,v1=<hex_signature>]`
     */
    signatureHeader: string;
    /**
     * The webhook signing secret from the DEVUP AI Dashboard.
     */
    secret: string;
    /**
     * Maximum allowed difference, in seconds, between the request timestamp and the current time.
     * @default 300 (5 minutes)
     */
    toleranceSeconds?: number;
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
            // A signature that cannot be checked counts as not matching; the next one is tried.
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
 * Verifies the signature and timestamp of an incoming DEVUP AI webhook request.
 *
 * Important: `rawBody` must be the exact string or byte sequence (Buffer/Uint8Array) received
 * in the HTTP request, before any JSON parsing. Re-serialising a parsed object changes its
 * formatting, and the signature no longer matches.
 *
 * @param params - Verification parameters: rawBody, signatureHeader, secret and optional toleranceSeconds.
 * @returns A promise resolving to `true` when the signature matches and the timestamp is within tolerance, `false` otherwise. Never throws for an invalid signature.
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
 * Verifies an incoming DEVUP AI webhook request, then parses and returns the typed event payload.
 *
 * Important: `rawBody` must be the exact string or byte sequence (Buffer/Uint8Array) received
 * in the HTTP request, before any JSON parsing. Re-serialising a parsed object changes its
 * formatting, and the signature no longer matches.
 *
 * @param params - Verification parameters: rawBody, signatureHeader, secret and optional toleranceSeconds.
 * @returns A promise resolving to the parsed, typed webhook event payload.
 * @throws {DevupWebhookVerificationError} When the header is malformed (`malformed_header`), the timestamp is outside tolerance (`timestamp_outside_tolerance`), no signature matches (`no_matching_signature`), or the body is not valid JSON (`invalid_json`).
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
 * Webhook helpers: signature verification and typed event construction.
 */
export class Webhooks {
    /**
     * Verifies the signature and timestamp of an incoming DEVUP AI webhook request.
     *
     * Important: `rawBody` must be the exact string or byte sequence (Buffer/Uint8Array) received
     * in the HTTP request, before any JSON parsing. Re-serialising a parsed object changes its
     * formatting, and the signature no longer matches.
     *
     * @param params - The verification parameters.
     * @returns A promise resolving to `true` when valid, `false` otherwise. Never throws.
     */
    verifySignature(params: VerifyWebhookSignatureParams): Promise<boolean> {
        return verifyWebhookSignature(params);
    }

    /**
     * Verifies the webhook signature, parses the request body and returns the typed event payload.
     *
     * Important: `rawBody` must be the exact string or byte sequence (Buffer/Uint8Array) received
     * in the HTTP request, before any JSON parsing. Re-serialising a parsed object changes its
     * formatting, and the signature no longer matches.
     *
     * @param params - The verification parameters.
     * @returns A promise resolving to the typed webhook event payload.
     * @throws {DevupWebhookVerificationError} When verification is rejected or the body is not valid JSON.
     */
    constructEvent<T = WebhookEvent>(params: VerifyWebhookSignatureParams): Promise<T> {
        return constructWebhookEvent<T>(params);
    }
}
