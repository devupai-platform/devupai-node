/**
 * Public request and response types of the DEVUP AI API.
 *
 * Every type here is an alias of the schema generated from the OpenAPI document
 * (`src/internal/openapi-schema.ts`, produced by `npm run generate:types`).
 * Fields that carry files in multipart requests are typed as `Blob | File | Uint8Array`.
 */

import type { components } from "./internal/openapi-schema";

type Schemas = components["schemas"];

/** A file sent in a multipart request. */
type BinaryInput = Blob | File | Uint8Array;

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** Billing metadata and notices attached to a response (`_devup`). Every field is optional; check for it before reading it. */
export type DevUpBilling = Schemas["DevUpBilling"];

/** Token usage of a chat completion. */
export type TokenUsage = Schemas["TokenUsage"];

/** The body of an HTTP error response. `error.code` is a string; the codes you can act on are listed at https://docs.devupai.com/docs/errors. */
export type ErrorResponse = Schemas["ErrorResponse"];

// ---------------------------------------------------------------------------
// Chat completions
// ---------------------------------------------------------------------------

/** One part of a chat message's `content` array. */
export type ChatContentPart = Schemas["ChatContentPart"];

/** A text part of a chat message. */
export type ChatContentPartText = Schemas["ChatContentPartText"];

/** An image part of a chat message. */
export type ChatContentPartImageUrl = Schemas["ChatContentPartImageUrl"];

/** A PDF part of a chat message. */
export type ChatContentPartFile = Schemas["ChatContentPartFile"];

/** A message sent in `messages` of `POST /v1/chat/completions`. */
export type ChatCompletionMessageParam = Schemas["ChatCompletionRequest"]["messages"][number];

/** A message returned in `choices[].message` of a chat completion. */
export type ChatCompletionMessage = Schemas["ChatMessage"];

/** One choice of a chat completion. */
export type ChatCompletionChoice = Schemas["ChatCompletionResponse"]["choices"][number];

/** The response of `POST /v1/chat/completions` without streaming. */
export type ChatCompletion = Schemas["ChatCompletionResponse"];

/** The request body of `POST /v1/chat/completions`. */
export type ChatCompletionCreateParams = Schemas["ChatCompletionRequest"];

/** The request body of a streaming chat completion (`stream: true`). */
export type ChatCompletionCreateParamsStreaming = Omit<ChatCompletionCreateParams, "stream"> & {
    stream: true;
};

/** The request body of a chat completion without streaming. */
export type ChatCompletionCreateParamsNonStreaming = Omit<ChatCompletionCreateParams, "stream"> & {
    stream?: false;
};

/**
 * One event of a chat completion stream. When the model completes its reply, the last
 * chunk has an empty `choices` array and carries `usage`.
 */
export type ChatCompletionChunk = Schemas["ChatCompletionChunk"];

/** One choice of a chat completion chunk. */
export type ChatCompletionChunkChoice = ChatCompletionChunk["choices"][number];

/** The part of the message added by one chunk. */
export type ChatCompletionChunkDelta = ChatCompletionChunkChoice["delta"];

/**
 * @deprecated Use {@link ChatCompletionChunk}. Kept so code written for 3.x compiles.
 */
export type ChatCompletionDeltaChunk = ChatCompletionChunk;

/** The error event a chat completion stream sends when an error occurs after the stream has started. */
export type ChatCompletionStreamError = Schemas["ChatCompletionStreamError"];

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** The request body of `POST /v1/responses`. */
export type ResponseCreateParams = Schemas["ResponsesRequest"];

/** The request body of a streaming Responses request (`stream: true`). */
export type ResponseCreateParamsStreaming = Omit<ResponseCreateParams, "stream"> & {
    stream: true;
};

/** The request body of a Responses request without streaming. */
export type ResponseCreateParamsNonStreaming = Omit<ResponseCreateParams, "stream"> & {
    stream?: false;
};

/** The response of `POST /v1/responses`, also carried by some stream events in `response`. */
export type ResponseObject = Schemas["ResponsesResponse"];

/** The event types a `POST /v1/responses` stream sends. */
export type ResponseStreamEventType = Schemas["ResponsesStreamEventType"];

/** The last event of a Responses stream whose response could not be completed (`type: "error"`). */
export type ResponseStreamErrorEvent = Schemas["ResponsesStreamErrorEvent"];

/**
 * Any event of a Responses stream other than `error`: one of the listed types, or another
 * `response.*` event type of the OpenAI-compatible Responses API. Typed this way (and not as
 * any string) so that checking `type === "error"` selects {@link ResponseStreamErrorEvent}.
 */
type ResponseStreamDataEvent = Schemas["ResponsesStreamEvent"] & {
    type: Exclude<ResponseStreamEventType, "error"> | `response.${string}`;
};

/**
 * One event of a `POST /v1/responses` stream (`stream: true`). Switch on `type`;
 * `case "error"` gives a {@link ResponseStreamErrorEvent}. Skip any type your code does not handle.
 */
export type ResponseStreamEvent = ResponseStreamDataEvent | ResponseStreamErrorEvent;

// ---------------------------------------------------------------------------
// Embeddings and rerank
// ---------------------------------------------------------------------------

/** The request body of `POST /v1/embeddings`. */
export type EmbeddingCreateParams = Schemas["EmbeddingRequest"];

/** The response of `POST /v1/embeddings`. Each `embedding` is a `number[]`, or a base64 string when `encoding_format` is `base64`. */
export type EmbeddingCreateResponse = Schemas["EmbeddingResponse"];

/** The request body of `POST /v1/rerank`. */
export type RerankCreateParams = Schemas["RerankRequest"];

/** The response of `POST /v1/rerank`. */
export type RerankCreateResponse = Schemas["RerankResponse"];

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** The request body of `POST /v1/images/generations` (JSON). */
export type ImageGenerateParams = Schemas["ImageGenerationRequest"];

/** The response of an image generation or edit. */
export type ImageGenerateResponse = Schemas["ImageGenerationResponse"];

/** An input image given as an object: `{ image_url }`, where the value is an HTTPS URL or a data URI. */
export type ImageInputUrl = Schemas["ImageInputUrl"];

/**
 * The fields of an image edit sent as JSON to `POST /v1/images/edits`: every input image
 * (`images`, `image`, `mask`, `markup`) is an HTTPS URL or a data URI, as a string or as `{ image_url }`.
 */
export type ImageEditJsonParams = Schemas["ImageEditJsonRequest"];

/** One input of a multipart image edit: a file, or an HTTPS URL or data URI as text. */
export type ImageEditInput = BinaryInput | string;

/** The fields of an image edit sent as `multipart/form-data` to `POST /v1/images/edits`. */
export type ImageEditParams = Omit<Schemas["ImageEditRequest"], "image" | "mask" | "markup"> & {
    /** The image to edit, or several images in order; the first is the one a mask or markup applies to. */
    image?: ImageEditInput | ImageEditInput[];
    /** Optional mask for inpainting. */
    mask?: ImageEditInput;
    /** Optional markup drawn over the first image. */
    markup?: ImageEditInput;
};

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

/** The request body of `POST /v1/audio/speech`. */
export type SpeechCreateParams = Schemas["SpeechRequest"];

/** The response of `POST /v1/audio/speech`. */
export type SpeechResponse = Schemas["SpeechResponse"];

/** The fields of a transcription, sent as `multipart/form-data`. */
export type TranscriptionCreateParams = Omit<Schemas["TranscriptionRequest"], "file"> & {
    /** The audio file to transcribe. */
    file: BinaryInput;
};

/** The JSON response of a transcription (`response_format` `json`). */
export type TranscriptionResponse = Schemas["TranscriptionResponse"];

/** The JSON response of a transcription with `response_format` `verbose_json`. */
export type TranscriptionVerboseResponse = Schemas["TranscriptionVerboseResponse"];

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

/** The request body of `POST /v1/video/generations`. */
export type VideoGenerationCreateParams = Schemas["VideoGenerationRequest"];

/** The first or last frame of a video: an HTTPS URL or a data URI, as a string or as `{ image_url }`. */
export type VideoFrameImage = Schemas["VideoFrameImage"];

/** A reference image of a video generation. */
export type VideoReferenceImage = Schemas["VideoReferenceImage"];

/** A reference video of a video generation. */
export type VideoReferenceVideo = Schemas["VideoReferenceVideo"];

/** A reference audio file of a video generation. */
export type VideoReferenceAudio = Schemas["VideoReferenceAudio"];

/** A voice audio sample attached to a reference item. */
export type VideoReferenceVoiceAudio = Schemas["VideoReferenceVoiceAudio"];

/** The fields of a video generation sent as `multipart/form-data`, as the API describes them. */
export type VideoGenerationFormRequest = Schemas["VideoGenerationFormRequest"];

/** One media input of a multipart video generation: a file, or an HTTPS URL or data URI as text. */
export type VideoMediaInput = BinaryInput | string;

/**
 * The fields of a video generation sent as `multipart/form-data`: the frames and reference
 * files are sent as files. A `reference_*` field takes one item or an array of items.
 */
export type VideoGenerationCreateFormParams = Omit<
    VideoGenerationFormRequest,
    "image" | "last_frame_image" | "reference_images" | "reference_videos" | "reference_audios"
> & {
    /** The first frame of the video. */
    image?: VideoMediaInput;
    /** The last frame of the video. */
    last_frame_image?: VideoMediaInput;
    /** Reference images, in order. */
    reference_images?: VideoMediaInput | VideoMediaInput[];
    /** Reference videos, in order. */
    reference_videos?: VideoMediaInput | VideoMediaInput[];
    /** Reference audio files, in order. */
    reference_audios?: VideoMediaInput | VideoMediaInput[];
};

/** One key point of a video edit in `key_points` mode. */
export type VideoKeyPoint = {
    x: number;
    y: number;
    type: "positive" | "negative";
};

/** The fields of a video edit, sent as `multipart/form-data`. */
export type VideoEditCreateParams = Omit<Schemas["VideoEditRequest"], "video" | "mask" | "key_points"> & {
    /** Source video file for editing. */
    video: BinaryInput;
    /** Mask video for region-based editing. */
    mask?: BinaryInput;
    /** Key points for `key_points` mode: a JSON string or an array (sent as a JSON string). */
    key_points?: string | VideoKeyPoint[];
};

/** The response of a video generation or edit. */
export type VideoGenerationResponse = Schemas["VideoGenerationResponse"];

// ---------------------------------------------------------------------------
// Models, account and health
// ---------------------------------------------------------------------------

/** One model of `GET /v1/models`. */
export type ModelObject = Schemas["ModelObject"];

/** The response of `GET /v1/models`. */
export type ModelListResponse = Schemas["ModelListResponse"];

/** The response of `GET /v1/user/balance`. */
export type BalanceResponse = Schemas["BalanceResponse"];

/** The response of `GET /v1/me`: the profile of the account that owns the API key. */
export type AccountProfile = Schemas["AccountProfile"];

/** Where to fetch the account's profile picture (`GET /v1/me/avatar`), and its current `etag`. */
export type AccountAvatar = Schemas["AccountAvatar"];

/** The response of `GET /health`. */
export type HealthResponse = Schemas["HealthResponse"];
