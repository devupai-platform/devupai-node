import type { RequestOptions } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import type { BalanceResponse } from "../types";
import { APIResource, mergeRequestOptions } from "./shared";

/** Account balance resource: `GET /user/balance`. */
export class Balance extends APIResource {
    /**
     * Retrieves the current account balance in DZD.
     *
     * @example
     * ```ts
     * const balance = await client.balance.retrieve();
     * ```
     */
    retrieve(options?: RequestOptions): APIPromise<BalanceResponse> {
        return this._client.json<BalanceResponse>({
            method: "GET",
            path: "/user/balance",
            auth: true,
            options: mergeRequestOptions(undefined, options),
        });
    }
}
