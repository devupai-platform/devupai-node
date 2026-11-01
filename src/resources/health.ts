import type { RequestOptions } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import type { HealthResponse } from "../types";
import { APIResource, mergeRequestOptions } from "./shared";

/** Health resource: `GET /health` (next to the versioned API path). */
export class Health extends APIResource {
    /**
     * Checks that the API is reachable. Sends no API key.
     *
     * @example
     * ```ts
     * const health = await client.health.check();
     * ```
     */
    check(options?: RequestOptions): APIPromise<HealthResponse> {
        const url = new URL("../health", `${this._client.baseURL}/`).toString();
        return this._client.json<HealthResponse>({
            method: "GET",
            url,
            auth: false,
            options: mergeRequestOptions(undefined, options),
        });
    }
}
