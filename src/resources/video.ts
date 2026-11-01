import type { APIClient, RequestOptions } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import type {
    VideoEditCreateParams,
    VideoGenerationCreateParams,
    VideoGenerationResponse,
} from "../types";
import { APIResource, appendField, prepareRequest, toBlob } from "./shared";

/** Video generation resource: `POST /video/generations` (JSON). */
export class VideoGenerations extends APIResource {
    /**
     * Generates a video from a prompt.
     *
     * Request options can be passed as the second argument, or inside `params`; the
     * second argument wins.
     *
     * @example
     * ```ts
     * const video = await client.video.generations.create({ model: "<model-id>", prompt: "A sunrise" });
     * ```
     */
    create(
        params: VideoGenerationCreateParams & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<VideoGenerationResponse> {
        const { body, options: requestOptions } = prepareRequest(params, options);
        return this._client.json<VideoGenerationResponse>({
            method: "POST",
            path: "/video/generations",
            body,
            auth: true,
            options: requestOptions,
        });
    }
}

/** Video editing resource: `POST /video/generations` (multipart). */
export class VideoEdits extends APIResource {
    /**
     * Edits a video. The video (and optional mask) are uploaded as multipart form data;
     * `key_points` may be given as an array, which is sent as a JSON string.
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
