import type { ConditionalRequestOptions, RequestOptions } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import type { AccountProfile } from "../types";
import { APIResource, mergeRequestOptions } from "./shared";

/** Account profile resource: `GET /me` and `GET /me/avatar`. Both use the API key. */
export class Me extends APIResource {
    /**
     * Retrieves the profile of the account that owns the API key: a display name, an
     * initial, a masked email hint and, when the account has a picture, the URL and
     * `etag` of {@link Me.avatar}.
     *
     * @example
     * ```ts
     * const profile = await client.me.retrieve();
     * console.log(profile.display_name ?? profile.initial);
     * ```
     */
    retrieve(options?: RequestOptions): APIPromise<AccountProfile> {
        return this._client.json<AccountProfile>({
            method: "GET",
            path: "/me",
            auth: true,
            options: mergeRequestOptions(undefined, options),
        });
    }

    /**
     * Fetches the account's profile picture. Resolves with the `Response` with its body
     * unread: read `response.headers.get("content-type")`, `response.headers.get("etag")`
     * and the bytes with `response.arrayBuffer()`.
     *
     * With `ifNoneMatch` set to the `etag` of a copy you already have (from
     * {@link Me.retrieve} or a previous `ETag` header), an unchanged picture resolves
     * with a `Response` of status `304` and an empty body instead of the bytes.
     *
     * An account without a picture throws a `NotFoundError` (code `avatar_not_found`).
     *
     * @example
     * ```ts
     * const response = await client.me.avatar();
     * const bytes = new Uint8Array(await response.arrayBuffer());
     * const etag = response.headers.get("etag");
     *
     * // Later: status 304 while the picture is unchanged.
     * const again = await client.me.avatar({ ifNoneMatch: etag! });
     * if (again.status !== 304) {
     *     // A new picture: read `again.arrayBuffer()`.
     * }
     * ```
     */
    avatar(options?: ConditionalRequestOptions): APIPromise<Response> {
        const { ifNoneMatch, ...requestOptions } = options ?? {};
        return this._client.raw({
            method: "GET",
            path: "/me/avatar",
            auth: true,
            ifNoneMatch,
            options: mergeRequestOptions(undefined, requestOptions),
        });
    }
}
