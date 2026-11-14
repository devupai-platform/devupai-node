import type { APIClient, RequestOptions } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import type {
    VideoEditCreateParams,
    VideoGenerationCreateFormParams,
    VideoGenerationCreateParams,
    VideoGenerationResponse,
} from "../types";
import { APIResource, appendField, appendInput, isBinaryInput, isRecord, prepareRequest, toBlob } from "./shared";

/** True when `value`, or one item of an array `value`, is a file (`Blob`, `File` or `Uint8Array`). */
function containsFile(value: unknown): boolean {
    if (Array.isArray(value)) return value.some(isBinaryInput);
    return isBinaryInput(value);
}

/**
 * Appends one request field as form parts. A file is a file part and a string a text
 * part; an array gives one part per item under the plain field name; a number or a
 * boolean is sent as text (`8`, `true`); an object is sent as its JSON text.
 * `undefined` and `null` are left out.
 */
function appendPart(form: FormData, name: string, value: unknown): void {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
        for (const item of value) appendPart(form, name, item);
        return;
    }
    if (isBinaryInput(value) || typeof value === "string") {
        appendInput(form, name, value);
        return;
    }
    if (isRecord(value)) {
        form.append(name, JSON.stringify(value));
        return;
    }
    appendField(form, name, value as number | boolean);
}

/** Video generation resource: `POST /video/generations` (JSON, or multipart when a media input is a file). */
export class VideoGenerations extends APIResource {
    /**
     * Generates a video from a prompt.
     *
     * The request has two forms, selected by the media inputs (`image`,
     * `last_frame_image`, `reference_images`, `reference_videos`, `reference_audios`):
     *
     * - When every media input is text (an HTTPS URL, a data URI or an object with
     *   one), the params are sent as JSON ({@link VideoGenerationCreateParams}).
     * - When any media input is a file (`Blob`, `File` or `Uint8Array`), the params are
     *   sent as `multipart/form-data` ({@link VideoGenerationCreateFormParams}): files
     *   are file parts, text inputs are text parts, a `reference_*` field gives one
     *   part per item under the plain field name, and every other field is sent as
     *   text (`duration: 8` becomes `"8"`, `generate_audio: true` becomes `"true"`).
     *
     * Request options can be passed as the second argument, or inside `params`; the
     * second argument wins.
     *
     * @example JSON
     * ```ts
     * const video = await client.video.generations.create({ model: "<model-id>", prompt: "A sunrise" });
     * ```
     *
     * @example Multipart, with the first frame and two reference images as files
     * ```ts
     * const video = await client.video.generations.create({
     *     model: "<model-id>",
     *     prompt: "The person in image 1 walks towards the camera",
     *     image: firstFrameBlob,
     *     reference_images: [personBlob, "https://example.com/background.png"],
     *     duration: 8,
     * });
     * ```
     */
    create(params: VideoGenerationCreateParams & RequestOptions, options?: RequestOptions): APIPromise<VideoGenerationResponse>;
    create(params: VideoGenerationCreateFormParams & RequestOptions, options?: RequestOptions): APIPromise<VideoGenerationResponse>;
    create(
        params: (VideoGenerationCreateParams | VideoGenerationCreateFormParams) & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<VideoGenerationResponse> {
        const { body, options: requestOptions } = prepareRequest(params, options);
        const fields = Object.entries(body as Record<string, unknown>);
        if (!fields.some(([, value]) => containsFile(value))) {
            return this._client.json<VideoGenerationResponse>({
                method: "POST",
                path: "/video/generations",
                body,
                auth: true,
                options: requestOptions,
            });
        }
        const form = new FormData();
        for (const [name, value] of fields) appendPart(form, name, value);
        return this._client.json<VideoGenerationResponse>({
            method: "POST",
            path: "/video/generations",
            body: form,
            auth: true,
            options: requestOptions,
        });
    }
}

/** Video editing resource: `POST /video/generations` (multipart). */
export class VideoEdits extends APIResource {
    /**
     * Edits a video. The video (and optional mask) are uploaded as multipart form data;
     * `key_points` may be given as an array, which is sent as a JSON string. The request
     * is handled as an edit on models that offer video editing.
     *
     * Request options can be passed as the second argument, or inside `params`; the
     * second argument wins.
     *
     * @example
     * ```ts
     * const result = await client.video.edits.create({
     *     model: "<model-id>",
     *     video: videoBlob,
     *     prompt: "Make the sky blue",
     * });
     * ```
     */
    create(
        params: VideoEditCreateParams & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<VideoGenerationResponse> {
        const { body, options: requestOptions } = prepareRequest(params, options);
        const form = new FormData();
        form.append("video", toBlob(body.video));
        appendField(form, "model", body.model);
        appendField(form, "prompt", body.prompt);
        if (body.mask !== undefined && body.mask !== null) {
            form.append("mask", toBlob(body.mask));
        }
        appendField(form, "mask_url", body.mask_url);
        if (body.key_points !== undefined && body.key_points !== null) {
            const keyPoints = typeof body.key_points === "string" ? body.key_points : JSON.stringify(body.key_points);
            form.append("key_points", keyPoints);
        }
        appendField(form, "frame_index", body.frame_index);
        appendField(form, "auto_trim", body.auto_trim);
        appendField(form, "preserve_audio", body.preserve_audio);
        appendField(form, "background_color", body.background_color);
        appendField(form, "desired_increase", body.desired_increase);
        appendField(form, "output_container_and_codec", body.output_container_and_codec);
        appendField(form, "response_format", body.response_format);

        return this._client.json<VideoGenerationResponse>({
            method: "POST",
            path: "/video/generations",
            body: form,
            auth: true,
            options: requestOptions,
        });
    }
}

/** Video resources. */
export class Video extends APIResource {
    /** Video generation from a prompt. */
    readonly generations: VideoGenerations;
    /** Video editing. */
    readonly edits: VideoEdits;

    constructor(client: APIClient) {
        super(client);
        this.generations = new VideoGenerations(client);
        this.edits = new VideoEdits(client);
    }
}
