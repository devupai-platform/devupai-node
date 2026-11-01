import type { APIClient, RequestOptions, StreamConfig } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import type { Stream } from "../core/streaming";
import type {
    ChatCompletion,
    ChatCompletionChunk,
    ChatCompletionCreateParams,
    ChatCompletionCreateParamsNonStreaming,
    ChatCompletionCreateParamsStreaming,
} from "../types";
import {
    APIResource,
    DEFAULT_STREAM_ERROR_MESSAGE,
    isRecord,
    prepareRequest,
    stringOrUndefined,
} from "./shared";

/**
 * Reads the error event of a chat completion stream: an object with an `error`
 * object and no `choices`. Any other frame is a regular chunk.
 */
const chatStreamConfig: StreamConfig = {
    errorFrame(frame) {
        if (!isRecord(frame) || "choices" in frame || !isRecord(frame.error)) return null;
        const error = frame.error;
        return {
            message: stringOrUndefined(error.message) ?? DEFAULT_STREAM_ERROR_MESSAGE,
            code: stringOrUndefined(error.code),
            type: stringOrUndefined(error.type),
            param: stringOrUndefined(error.param) ?? null,
        };
    },
};

/** Chat completions: `POST /chat/completions`. */
export class Completions extends APIResource {
    /**
     * Creates a model response for the given chat conversation.
     *
     * With `stream: true` the result is a {@link Stream} of {@link ChatCompletionChunk}s;
     * send `stream_options: { include_usage: true }` to receive token usage on the final
     * chunk. An error event inside the stream is thrown as a `DevupAPIError` carrying the
     * error `code` and the request id of the stream.
     *
     * Request options (`signal`, `timeout`, `maxRetries`, `headers`, `streamIdleTimeout`)
     * can be passed as the second argument, or inside `params` as in 3.x; the second
     * argument wins.
     *
     * @example
     * ```ts
     * const completion = await client.chat.completions.create({
     *     model: "<model-id>",
     *     messages: [{ role: "user", content: "Hello" }],
     * });
     * ```
     */
    create(
        params: ChatCompletionCreateParamsStreaming & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<Stream<ChatCompletionChunk>>;
    create(
        params: ChatCompletionCreateParamsNonStreaming & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<ChatCompletion>;
    create(
        params: ChatCompletionCreateParams & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<Stream<ChatCompletionChunk> | ChatCompletion>;
    create(
        params: (ChatCompletionCreateParams | ChatCompletionCreateParamsNonStreaming) & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<Stream<ChatCompletionChunk> | ChatCompletion> {
        const { body, options: requestOptions } = prepareRequest(params, options);
        const request = {
            method: "POST" as const,
            path: "/chat/completions",
            body,
            auth: true,
            options: requestOptions,
        };
        if (body.stream === true) {
            return this._client.stream<ChatCompletionChunk>(request, chatStreamConfig);
        }
        return this._client.json<ChatCompletion>(request);
    }
}

/** Chat resource. */
export class Chat extends APIResource {
    /** Chat completions. */
    readonly completions: Completions;

    constructor(client: APIClient) {
        super(client);
        this.completions = new Completions(client);
    }
}
