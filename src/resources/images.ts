import type { RequestOptions } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import { DevupAPIError } from "../core/errors";
import type { ImageEditJsonParams, ImageEditParams, ImageGenerateParams, ImageGenerateResponse } from "../types";
import {
    APIResource,
    appendField,
    appendInput,
    isBinaryInput,
    isRecord,
    mergeRequestOptions,
    prepareRequest,
    rejectedAPIPromise,
    type BinaryInput,
} from "./shared";

/** Message of the error thrown by `images.download` for a URL it does not fetch. */
const INVALID_FILE_URL_MESSAGE = "images.download only fetches URLs returned by the API.";

/** The request fields of an image edit that carry input images (`images` is the list form of `image`). */
const IMAGE_INPUT_FIELDS: ReadonlyArray<string> = ["image", "images", "mask", "markup"];

/** The items of an input field: a list as is, one value as a list of one, nothing when unset. */
function inputItems(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    return value === undefined || value === null ? [] : [value];
}

/** One input item as a form part: a file, a text value (URL or data URI), or the `image_url` of an object. */
function inputPart(item: unknown): BinaryInput | string | undefined {
    if (typeof item === "string" || isBinaryInput(item)) return item;
    if (isRecord(item) && typeof item.image_url === "string") return item.image_url;
    return undefined;
}

/**
 * Builds the `multipart/form-data` body of an image edit from the request fields: one `image`
 * part per input image (`image` and `images`), one part each for `mask` and `markup`, and every
 * other field as a text part (`undefined` and `null` left out). Every field of the body is sent,
 * so a field added to the request shape reaches the form without a change here.
 */
function editForm(body: Record<string, unknown>): FormData {
    const form = new FormData();
    for (const [name, value] of Object.entries(body)) {
        if (IMAGE_INPUT_FIELDS.includes(name)) {
            const partName = name === "images" ? "image" : name;
            for (const item of inputItems(value)) {
                const part = inputPart(item);
                if (part !== undefined) appendInput(form, partName, part);
            }
        } else if (typeof value === "object" && value !== null) {
            form.append(name, JSON.stringify(value));
        } else {
            appendField(form, name, value as string | number | boolean | null | undefined);
        }
    }
    return form;
}

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
     * Edits one or more images as the prompt describes (`POST /images/edits`).
     *
     * The request takes one of two forms, chosen from the input images (`image`, `images`,
     * `mask`, `markup`):
     *
     * - When every input is an HTTPS URL or a data URI (a string or `{ image_url }`), the
     *   params are sent as JSON, exactly as given.
     * - When at least one input is a file (`Blob`, `File` or `Uint8Array`), the params are
     *   sent as `multipart/form-data`: one `image` part per input image, in order; one
     *   `mask` and one `markup` part when given (a file, or a URL or data URI as text);
     *   every other field as a text part.
     *
     * Request options can be passed as the second argument, or inside `params`; the
     * second argument wins.
     *
     * @example JSON form: images given as URLs or data URIs
     * ```ts
     * const result = await client.images.edit({
     *     model: "<model-id>",
     *     prompt: "Replace the sky with a starry night",
     *     images: ["https://example.com/photo.png"],
     *     mask: { image_url: "https://example.com/mask.png" },
     * });
     * ```
     *
     * @example Multipart form: images given as files
     * ```ts
     * const result = await client.images.edit({
     *     model: "<model-id>",
     *     prompt: "Add a hat",
     *     image: [firstImageBlob, secondImageBlob],
     *     mask: maskBlob,
     * });
     * ```
     */
    edit(params: ImageEditJsonParams & RequestOptions, options?: RequestOptions): APIPromise<ImageGenerateResponse>;
    edit(params: ImageEditParams & RequestOptions, options?: RequestOptions): APIPromise<ImageGenerateResponse>;
    edit(
        params: (ImageEditJsonParams | ImageEditParams) & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<ImageGenerateResponse> {
        const { body, options: requestOptions } = prepareRequest(params, options);
        const fields = body as Record<string, unknown>;
        const hasFile = IMAGE_INPUT_FIELDS.some((name) => inputItems(fields[name]).some(isBinaryInput));
        return this._client.json<ImageGenerateResponse>({
            method: "POST",
            path: "/images/edits",
            body: hasFile ? editForm(fields) : body,
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
