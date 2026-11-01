import type { RequestOptions } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import type { RerankCreateParams, RerankCreateResponse } from "../types";
import { APIResource, prepareRequest } from "./shared";

/** Rerank resource: `POST /rerank`. */
export class Rerank extends APIResource {
    /**
     * Orders documents by their relevance to a query.
     *
     * Request options can be passed as the second argument, or inside `params`; the
     * second argument wins.
     *
     * @example
     * ```ts
     * const result = await client.rerank.create({
     *     model: "<model-id>",
     *     query: "What is DZD?",
     *     documents: ["The Algerian dinar.", "A file format."],
     * });
     * ```
     */
    create(params: RerankCreateParams & RequestOptions, options?: RequestOptions): APIPromise<RerankCreateResponse> {
        const { body, options: requestOptions } = prepareRequest(params, options);
        return this._client.json<RerankCreateResponse>({
            method: "POST",
            path: "/rerank",
            body,
            auth: true,
            options: requestOptions,
        });
    }
}
