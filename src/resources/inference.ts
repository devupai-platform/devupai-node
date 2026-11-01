import type { RequestOptions } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import { APIResource, mergeRequestOptions } from "./shared";

/**
 * Encodes a model path as one URL path segment. Leading slashes are removed, and a
 * path that is already encoded is decoded first, so it is encoded exactly once
 * (`/` becomes `%2F`).
 */
function encodeModelPath(modelPath: string): string {
    const cleanPath = modelPath.replace(/^\/+/, "");
    try {
        return encodeURIComponent(decodeURIComponent(cleanPath));
    } catch (_e) {
        // Not a valid percent-encoded string: encode it as it is.
        return encodeURIComponent(cleanPath);
    }
}

/** Native inference resource: `POST /inference/{model}`. */
export class NativeInference extends APIResource {
    /**
     * Sends a model-specific JSON payload to a model and returns its JSON result.
     * The payload is sent as it is; request options go in the third argument only.
     *
     * @param modelPath - The model id.
     * @param payload - The request body expected by that model.
     *
     * @example
     * ```ts
     * const result = await client.inference.run("<model-id>", { input: "Hello" });
     * ```
     */
    run<TResponse = unknown, TPayload extends Record<string, unknown> = Record<string, unknown>>(
        modelPath: string,
        payload: TPayload,
        options?: RequestOptions,
    ): APIPromise<TResponse> {
        return this._client.json<TResponse>({
            method: "POST",
            path: `/inference/${encodeModelPath(modelPath)}`,
            body: payload,
            auth: true,
            options: mergeRequestOptions(undefined, options),
        });
    }
}
