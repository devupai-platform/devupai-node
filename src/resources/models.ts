import type { ConditionalRequestOptions, RequestOptions } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import type { ModelListResponse, ModelObject } from "../types";
import { APIResource, mergeRequestOptions } from "./shared";

/**
 * Models resource: `GET /models` and `GET /models/{id}`. Both use the API key.
 *
 * Both answers carry an `ETag`. Pass it back as `ifNoneMatch` to receive `null`
 * (`304 Not Modified`) while the list or the model is unchanged.
 */
export class Models extends APIResource {
    /**
     * Lists the models available to your API key, with their capabilities and pricing.
     *
     * With `ifNoneMatch` set to the `ETag` of a previous answer, the method resolves with
     * `null` when the list is unchanged (`304 Not Modified`); `withResponse()` then gives
     * the 304 response and its `ETag`.
     *
     * @example
     * ```ts
     * const { data } = await client.models.list();
     * ```
     *
     * @example
     * ```ts
     * const first = await client.models.list().withResponse();
     * const etag = first.response.headers.get("etag");
     * // Later: `null` while the list is unchanged.
     * const again = etag ? await client.models.list({ ifNoneMatch: etag }) : await client.models.list();
     * ```
     */
    list(options: ConditionalRequestOptions & { ifNoneMatch: string }): APIPromise<ModelListResponse | null>;
    list(options?: RequestOptions & { ifNoneMatch?: never }): APIPromise<ModelListResponse>;
    list(options?: ConditionalRequestOptions): APIPromise<ModelListResponse | null>;
    list(options?: ConditionalRequestOptions): APIPromise<ModelListResponse | null> {
        const { ifNoneMatch, ...requestOptions } = options ?? {};
        return this._client.json<ModelListResponse | null>({
            method: "GET",
            path: "/models",
            auth: true,
            ifNoneMatch,
            options: mergeRequestOptions(undefined, requestOptions),
        });
    }

    /**
     * Retrieves one model by its id. The id is sent as one URL-encoded path segment,
     * so ids that contain `/` work as they are.
     *
     * With `ifNoneMatch` set to the `ETag` of a previous answer, the method resolves with
     * `null` when the model is unchanged (`304 Not Modified`); `withResponse()` then gives
     * the 304 response and its `ETag`.
     *
     * @param id - The model id, as listed by {@link Models.list}.
     *
     * @example
     * ```ts
     * const model = await client.models.retrieve("<model-id>");
     * ```
     */
    retrieve(id: string, options: ConditionalRequestOptions & { ifNoneMatch: string }): APIPromise<ModelObject | null>;
    retrieve(id: string, options?: RequestOptions & { ifNoneMatch?: never }): APIPromise<ModelObject>;
    retrieve(id: string, options?: ConditionalRequestOptions): APIPromise<ModelObject | null>;
    retrieve(id: string, options?: ConditionalRequestOptions): APIPromise<ModelObject | null> {
        const { ifNoneMatch, ...requestOptions } = options ?? {};
        return this._client.json<ModelObject | null>({
            method: "GET",
            path: `/models/${encodeURIComponent(id)}`,
            auth: true,
            ifNoneMatch,
            options: mergeRequestOptions(undefined, requestOptions),
        });
    }
}
