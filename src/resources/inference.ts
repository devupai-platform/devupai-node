import type { APIRequest, RequestOptions } from "../core/client";
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

/**
 * Options of {@link NativeInference.run}: the request options, plus how the answer is read.
 *
 * - `responseType: "json"` (the default) parses the answer as JSON.
 * - `responseType: "binary"` resolves with the `Response` itself, its body unread, for
 *   models that answer with a file (an image, an audio or a video).
 */
export type InferenceRunOptions = RequestOptions & { responseType?: "json" | "binary" };

/** Native inference resource: `POST /inference/{model}`. */
export class NativeInference extends APIResource {
    /**
     * Sends a model-specific payload to a model and returns its result. The payload is
     * sent as it is: a JSON object as JSON, a `FormData` as `multipart/form-data`.
     * Request options go in the third argument only.
     *
     * - JSON in, JSON out (the default): the answer is parsed as JSON.
     * - `FormData` in: the form is sent as multipart, with its files.
     * - `responseType: "binary"`: the answer is returned as the `Response` with its body
     *   unread, so the caller reads it with `arrayBuffer()`, `blob()` or `body`.
     *
     * @param modelPath - The model id.
     * @param payload - The request body expected by that model.
     * @param options - Request options, plus `responseType` ({@link InferenceRunOptions}).
     *
     * @example JSON payload and JSON answer
     * ```ts
     * const result = await client.inference.run("<model-id>", { input: "Hello" });
     * ```
     *
     * @example Multipart payload (a file) and JSON answer
     * ```ts
     * const form = new FormData();
     * form.append("audio", audioBlob, "clip.wav");
     * form.append("language", "fr");
     * const result = await client.inference.run("<model-id>", form);
     * ```
     *
     * @example Binary answer
     * ```ts
     * const response = await client.inference.run("<model-id>", { prompt: "A sunrise" }, { responseType: "binary" });
     * const bytes = new Uint8Array(await response.arrayBuffer());
     * ```
     */
    run<TResponse = unknown, TPayload extends Record<string, unknown> | FormData = Record<string, unknown> | FormData>(
        modelPath: string,
        payload: TPayload,
        options?: RequestOptions & { responseType?: "json" },
    ): APIPromise<TResponse>;
    run(
        modelPath: string,
        payload: Record<string, unknown> | FormData,
        options: RequestOptions & { responseType: "binary" },
    ): APIPromise<Response>;
    run(modelPath: string, payload: Record<string, unknown> | FormData, options?: InferenceRunOptions): APIPromise<unknown> {
        const { responseType, ...requestOptions } = options ?? {};
        const request: APIRequest = {
            method: "POST",
            path: `/inference/${encodeModelPath(modelPath)}`,
            body: payload,
            auth: true,
            options: mergeRequestOptions(undefined, requestOptions),
        };
        if (responseType === "binary") return this._client.raw(request);
        return this._client.json<unknown>(request);
    }
}
