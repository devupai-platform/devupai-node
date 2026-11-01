import type { RequestOptions, StreamConfig } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import type { Stream } from "../core/streaming";
import type {
    ResponseCreateParams,
    ResponseCreateParamsNonStreaming,
    ResponseCreateParamsStreaming,
    ResponseObject,
    ResponseStreamEvent,
} from "../types";
import {
    APIResource,
    DEFAULT_STREAM_ERROR_MESSAGE,
    isRecord,
    prepareRequest,
    stringOrUndefined,
} from "./shared";

/**
 * Reads the error event of a Responses stream: an event whose `type` is `error`, or an
 * SSE event named `error`. The message and code come from the event, or from its
 * `error` object.
 */
const responsesStreamConfig: StreamConfig = {
    errorFrame(frame, event) {
        const isErrorEvent = event === "error" || (isRecord(frame) && frame.type === "error");
        if (!isErrorEvent) return null;
        if (!isRecord(frame)) return { message: DEFAULT_STREAM_ERROR_MESSAGE };
        const inner = isRecord(frame.error) ? frame.error : undefined;
        return {
            message:
                stringOrUndefined(frame.message) ??
                stringOrUndefined(inner?.message) ??
                DEFAULT_STREAM_ERROR_MESSAGE,
            code: stringOrUndefined(frame.code) ?? stringOrUndefined(inner?.code),
            type: stringOrUndefined(inner?.type),
            param: stringOrUndefined(frame.param) ?? stringOrUndefined(inner?.param) ?? null,
        };
    },
};

/** Responses API: `POST /responses`. */
export class Responses extends APIResource {
    /**
     * Creates a model response.
     *
     * With `stream: true` the result is a {@link Stream} of {@link ResponseStreamEvent}s.
     * Skip any event type your code does not handle. An `error` event is thrown as a
     * `DevupAPIError` carrying the error `code` and the request id of the stream.
     *
     * Request options (`signal`, `timeout`, `maxRetries`, `headers`, `streamIdleTimeout`)
     * can be passed as the second argument, or inside `params`; the second argument wins.
     *
     * @example
     * ```ts
     * const response = await client.responses.create({
     *     model: "<model-id>",
     *     input: "Hello",
     * });
     * ```
     */
    create(
        params: ResponseCreateParamsStreaming & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<Stream<ResponseStreamEvent>>;
    create(
        params: ResponseCreateParamsNonStreaming & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<ResponseObject>;
    create(
        params: ResponseCreateParams & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<Stream<ResponseStreamEvent> | ResponseObject>;
    create(
        params: (ResponseCreateParams | ResponseCreateParamsNonStreaming) & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<Stream<ResponseStreamEvent> | ResponseObject> {
        const { body, options: requestOptions } = prepareRequest(params, options);
        const request = {
            method: "POST" as const,
            path: "/responses",
            body,
            auth: true,
            options: requestOptions,
        };
        if (body.stream === true) {
            return this._client.stream<ResponseStreamEvent>(request, responsesStreamConfig);
        }
        return this._client.json<ResponseObject>(request);
    }
}
