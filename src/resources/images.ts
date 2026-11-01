import type { RequestOptions } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import { DevupAPIError } from "../core/errors";
import type { ImageEditParams, ImageGenerateParams, ImageGenerateResponse } from "../types";
import { APIResource, appendField, mergeRequestOptions, prepareRequest, rejectedAPIPromise, toBlob } from "./shared";

/** Message of the error thrown by `images.download` for a URL it does not fetch. */
const INVALID_FILE_URL_MESSAGE = "images.download only fetches URLs returned by the API.";

/** Images resource: generation, editing, and fetching generated files. */
export class Images extends APIResource {
    /**
     * Generates images from a prompt (`POST /images/generations`, JSON).
     *
     * Request options can be passed as the second argument, or inside `params`; the
     * second argument wins.
     *
     * @example
     * ```ts
     * const result = await client.images.generate({ model: "<model-id>", prompt: "A red bicycle" });
     * ```
     */
    generate(params: ImageGenerateParams & RequestOptions, options?: RequestOptions): APIPromise<ImageGenerateResponse> {
        const { body, options: requestOptions } = prepareRequest(params, options);
        return this._client.json<ImageGenerateResponse>({
            method: "POST",
            path: "/images/generations",
            body,
            auth: true,
            options: requestOptions,
        });
    }

    /**
     * Edits an image from a source image, an optional mask and a prompt
     * (`POST /images/generations`, multipart form data).
     *
     * Request options can be passed as the second argument, or inside `params`; the
     * second argument wins.
     *
     * @example
     * ```ts
     * const result = await client.images.edit({
     *     model: "<model-id>",
     *     image: imageBlob,
     *     prompt: "Add a hat",
     * });
     * ```
     */
    edit(params: ImageEditParams & RequestOptions, options?: RequestOptions): APIPromise<ImageGenerateResponse> {
        const { body, options: requestOptions } = prepareRequest(params, options);
        const form = new FormData();
        form.append("image", toBlob(body.image));
        if (body.mask !== undefined && body.mask !== null) {
            form.append("mask", toBlob(body.mask));
        }
        appendField(form, "prompt", body.prompt);
        appendField(form, "model", body.model);
        appendField(form, "n", body.n);
        appendField(form, "size", body.size);
        appendField(form, "response_format", body.response_format);

        return this._client.json<ImageGenerateResponse>({
            method: "POST",
            path: "/images/generations",
            body: form,
            auth: true,
            options: requestOptions,
        });
    }

    /**
     * Fetches a generated image or video file from the URL returned by the API.
     *
     * Pass the URL exactly as you received it. Only URLs on the same origin as the
     * client's `baseURL`, without a user name or password, are fetched; any other URL
     * is rejected with a `DevupAPIError` (code `invalid_url`) before any request is
     * sent. No API key is sent. The result is the raw `Response`, with its body unread;
     * send a `Range` header in `options.headers` to fetch part of the file.
     *
     * @param url - A file URL from a generation response (for example `data[].url`).
     *
     * @example
     * ```ts
     * const response = await client.images.download(result.data[0].url);
     * const bytes = new Uint8Array(await response.arrayBuffer());
     * ```
     */
    download(url: string, options?: RequestOptions): APIPromise<Response> {
        const expectedOrigin = new URL(this._client.baseURL).origin;
        let target: URL | null = null;
        try {
            target = typeof url === "string" ? new URL(url) : null;
        } catch (_e) {
            // Not an absolute URL: rejected below.
            target = null;
        }
        if (
            target === null ||
            target.origin !== expectedOrigin ||
            target.username !== "" ||
            target.password !== ""
        ) {
            // The message never contains the URL.
            return rejectedAPIPromise<Response>(
                new DevupAPIError(0, INVALID_FILE_URL_MESSAGE, { code: "invalid_url" }),
            );
        }
        return this._client.raw({
            method: "GET",
            url: target.toString(),
            auth: false,
            options: mergeRequestOptions(undefined, options),
        });
    }
}
