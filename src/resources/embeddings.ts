import type { RequestOptions } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import type { EmbeddingCreateParams, EmbeddingCreateResponse } from "../types";
import { APIResource, prepareRequest } from "./shared";

/** Embeddings resource: `POST /embeddings`. */
export class Embeddings extends APIResource {
    /**
     * Creates embedding vectors for the input text. With `encoding_format: "base64"`
     * each `embedding` is a base64 string instead of an array of numbers.
     *
     * Request options can be passed as the second argument, or inside `params`; the
     * second argument wins.
     *
     * @example
     * ```ts
     * const result = await client.embeddings.create({ model: "<model-id>", input: "Hello" });
     * ```
     */
    create(params: EmbeddingCreateParams & RequestOptions, options?: RequestOptions): APIPromise<EmbeddingCreateResponse> {
        const { body, options: requestOptions } = prepareRequest(params, options);
        return this._client.json<EmbeddingCreateResponse>({
            method: "POST",
            path: "/embeddings",
            body,
            auth: true,
            options: requestOptions,
        });
    }
}
