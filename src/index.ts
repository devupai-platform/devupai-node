import { APIClient, type ClientOptions } from "./core/client";
import { Audio } from "./resources/audio";
import { Balance } from "./resources/balance";
import { Chat } from "./resources/chat";
import { Embeddings } from "./resources/embeddings";
import { Health } from "./resources/health";
import { Images } from "./resources/images";
import { NativeInference } from "./resources/inference";
import { Models } from "./resources/models";
import { Rerank } from "./resources/rerank";
import { Responses } from "./resources/responses";
import { Video } from "./resources/video";
import { Webhooks } from "./webhooks";

/**
 * The DEVUP AI client. Gives access to every endpoint of the API through resources.
 *
 * @example
 * ```ts
 * import DevupAI from "devupai";
 *
 * const client = new DevupAI({ apiKey: process.env.DEVUP_API_KEY! });
 * const completion = await client.chat.completions.create({
 *     model: "<model-id>",
 *     messages: [{ role: "user", content: "Hello" }],
 * });
 * ```
 */
class DevupAI {
    /** The base URL of the API, without a trailing slash. */
    readonly baseURL: string;
    /** Chat completions. */
    readonly chat: Chat;
    /** Responses API. */
    readonly responses: Responses;
    /** Models: list and retrieve. */
    readonly models: Models;
    /** Image generation, editing, and fetching generated files. */
    readonly images: Images;
    /** Text embeddings. */
    readonly embeddings: Embeddings;
    /** Document reranking. */
    readonly rerank: Rerank;
    /** Speech and transcription. */
    readonly audio: Audio;
    /** Video generation and editing. */
    readonly video: Video;
    /** Native inference with a model-specific payload. */
    readonly inference: NativeInference;
    /** Account balance. */
    readonly balance: Balance;
    /** API health check. */
    readonly health: Health;
    /** Webhook signature verification and event construction. */
    readonly webhooks: Webhooks;

    private readonly _client: APIClient;

    /**
     * Creates a client.
     *
     * @param options - `apiKey` (required), and optionally `baseURL`, `headers`,
     * `maxRetries`, `timeout`, `streamIdleTimeout`, `fetch` and `onDebug`.
     */
    constructor(options: ClientOptions) {
        this._client = new APIClient(options);
        this.baseURL = this._client.baseURL;
        this.chat = new Chat(this._client);
        this.responses = new Responses(this._client);
        this.models = new Models(this._client);
        this.images = new Images(this._client);
        this.embeddings = new Embeddings(this._client);
        this.rerank = new Rerank(this._client);
        this.audio = new Audio(this._client);
        this.video = new Video(this._client);
        this.inference = new NativeInference(this._client);
        this.balance = new Balance(this._client);
        this.health = new Health(this._client);
        this.webhooks = new Webhooks();
    }
}

export default DevupAI;
export { DevupAI };

/** @deprecated Use {@link ClientOptions}. Kept so 3.x code keeps compiling. */
export type DevUpAIOptions = ClientOptions;

export * from "./types";

export {
    DevupAPIError,
    AuthenticationError,
    PermissionDeniedError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    InternalServerError,
    APIConnectionError,
    APITimeoutError,
} from "./core/errors";
export { APIPromise } from "./core/api-promise";
export type { WithResponse } from "./core/api-promise";
export { Stream } from "./core/streaming";
export { VERSION } from "./core/version";
export type { ClientOptions, RequestOptions, DebugEvent } from "./core/client";

export {
    verifyWebhookSignature,
    constructWebhookEvent,
    Webhooks,
    DevupWebhookVerificationError,
} from "./webhooks";
export type {
    WebhookUsage,
    WebhookSuccessPayload,
    WebhookErrorDetails,
    WebhookErrorPayload,
    WebhookEvent,
    DevupWebhookVerificationErrorReason,
    VerifyWebhookSignatureParams,
} from "./webhooks";

export type { Chat, Completions } from "./resources/chat";
export type { Responses } from "./resources/responses";
export type { Models } from "./resources/models";
export type { Images } from "./resources/images";
export type { Embeddings } from "./resources/embeddings";
export type { Rerank } from "./resources/rerank";
export type { Audio, Speech, Transcriptions } from "./resources/audio";
export type { Video, VideoGenerations, VideoEdits } from "./resources/video";
export type { NativeInference } from "./resources/inference";
export type { Balance } from "./resources/balance";
export type { Health } from "./resources/health";
