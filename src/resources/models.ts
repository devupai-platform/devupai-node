import type { RequestOptions } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import type { ModelListResponse, ModelObject } from "../types";
import { APIResource, mergeRequestOptions } from "./shared";

/** Models resource: `GET /models` and `GET /models/{id}`. Both use the API key. */
export class Models extends APIResource {
    /**
     * Lists the models available to your API key, with their capabilities and pricing.
     *
     * @example
     * ```ts
     * const { data } = await client.models.list();
     * ```
     */
    list(options?: RequestOptions): APIPromise<ModelListResponse> {
        return this._client.json<ModelListResponse>({
            method: "GET",
            path: "/models",
            auth: true,
            options: mergeRequestOptions(undefined, options),
        });
    }

    /**
     * Retrieves one model by its id. The id is sent as one URL-encoded path segment,
     * so ids that contain `/` work as they are.
     *
     * @param id - The model id, as listed by {@link Models.list}.
     *
     * @example
     * ```ts
     * const model = await client.models.retrieve("<model-id>");
     * ```
     */
    retrieve(id: string, options?: RequestOptions): APIPromise<ModelObject> {
        return this._client.json<ModelObject>({
            method: "GET",
            path: `/models/${encodeURIComponent(id)}`,
            auth: true,
            options: mergeRequestOptions(undefined, options),
        });
    }
}
