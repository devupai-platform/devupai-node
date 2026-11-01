import type { APIClient, RequestOptions } from "../core/client";
import type { APIPromise } from "../core/api-promise";
import type {
    SpeechCreateParams,
    SpeechResponse,
    TranscriptionCreateParams,
    TranscriptionResponse,
    TranscriptionVerboseResponse,
} from "../types";
import { APIResource, appendField, prepareRequest, toBlob } from "./shared";

/** Speech resource: `POST /audio/speech`. */
export class Speech extends APIResource {
    /**
     * Generates spoken audio from the input text.
     *
     * Request options can be passed as the second argument, or inside `params`; the
     * second argument wins.
     *
     * @example
     * ```ts
     * const speech = await client.audio.speech.create({ model: "<model-id>", input: "Hello" });
     * ```
     */
    create(params: SpeechCreateParams & RequestOptions, options?: RequestOptions): APIPromise<SpeechResponse> {
        const { body, options: requestOptions } = prepareRequest(params, options);
        return this._client.json<SpeechResponse>({
            method: "POST",
            path: "/audio/speech",
            body,
            auth: true,
            options: requestOptions,
        });
    }
}

/** Response formats returned as plain text. */
type TextTranscriptionFormat = "text" | "srt" | "vtt";

function isTextFormat(format: unknown): format is TextTranscriptionFormat {
    return format === "text" || format === "srt" || format === "vtt";
}

/** Transcriptions resource: `POST /audio/transcriptions` (multipart). */
export class Transcriptions extends APIResource {
    /**
     * Transcribes an audio file.
     *
     * The result type follows `response_format`: `text`, `srt` and `vtt` return a string;
     * `verbose_json` returns {@link TranscriptionVerboseResponse}; `json` (the default)
     * returns {@link TranscriptionResponse}.
     *
     * Request options can be passed as the second argument, or inside `params`; the
     * second argument wins.
     *
     * @example
     * ```ts
     * const result = await client.audio.transcriptions.create({ file: audioBlob });
     * ```
     */
    create(
        params: TranscriptionCreateParams & { response_format: TextTranscriptionFormat } & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<string>;
    create(
        params: TranscriptionCreateParams & { response_format: "verbose_json" } & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<TranscriptionVerboseResponse>;
    create(
        params: TranscriptionCreateParams & { response_format?: "json" } & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<TranscriptionResponse>;
    create(
        params: TranscriptionCreateParams & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<TranscriptionResponse | TranscriptionVerboseResponse | string>;
    create(
        params: TranscriptionCreateParams & RequestOptions,
        options?: RequestOptions,
    ): APIPromise<TranscriptionResponse | TranscriptionVerboseResponse | string> {
        const { body, options: requestOptions } = prepareRequest(params, options);
        const form = new FormData();
        form.append("file", toBlob(body.file));
        appendField(form, "model", body.model);
        appendField(form, "language", body.language);
        appendField(form, "response_format", body.response_format);

        const request = {
            method: "POST" as const,
            path: "/audio/transcriptions",
            body: form,
            auth: true,
            options: requestOptions,
        };
        if (isTextFormat(body.response_format)) {
            return this._client.text(request);
        }
        return this._client.json<TranscriptionResponse | TranscriptionVerboseResponse>(request);
    }
}

/** Audio resources. */
export class Audio extends APIResource {
    /** Text to speech. */
    readonly speech: Speech;
    /** Speech to text. */
    readonly transcriptions: Transcriptions;

    constructor(client: APIClient) {
        super(client);
        this.speech = new Speech(client);
        this.transcriptions = new Transcriptions(client);
    }
}
