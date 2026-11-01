import { createOpenAICompatible, type OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import {
    LoadAPIKeyError,
    UnsupportedFunctionalityError,
    type EmbeddingModelV4,
    type ImageModelV4,
    type ImageModelV4CallOptions,
    type ImageModelV4Result,
    type LanguageModelV4,
    type ProviderV4,
} from "@ai-sdk/provider";
import { VERSION } from "./core/version";

/**
 * DEVUP AI integration for the Vercel AI SDK (`ai` version 7).
 *
 * Works with `generateText`, `streamText`, `generateObject`, `embed` and
 * `generateImage`. This entry point is ESM-only.
 *
 * @example
 * ```typescript
 * import { createDevupAI } from "devupai/ai";
 * import { streamText } from "ai";
 *
 * const devupai = createDevupAI({ apiKey: process.env.DEVUP_API_KEY });
 * const result = streamText({
 *     model: devupai("<model-id>"),
 *     prompt: "Hello!",
 * });
 * for await (const text of result.textStream) process.stdout.write(text);
 * ```
 *
 * @module
 */

const DEFAULT_BASE_URL = "https://api.devupai.com/v1";

/**
 * The part of a model object from `GET /v1/models` that this integration reads.
 * The `data` array returned by `models.list()` of the `devupai` client fits as is.
 */
export interface DevupAIModelData {
    /** The model id, as used in requests. */
    readonly id: string;
    /** Feature support flags of the model. */
    readonly supports?: {
        /** `true` when a `json_schema` response format returns JSON that matches the schema. */
        readonly structured_output?: boolean | null;
    } | null;
}

/**
 * Settings for {@link createDevupAI}.
 */
export interface DevupAIIntegrationSettings {
    /**
     * Your DEVUP AI API key. When omitted, the `DEVUP_API_KEY` environment
     * variable is used, then `DEVUPAI_API_KEY`. The key is read when a request
     * is made, so the environment can be set after the instance is created.
     */
    apiKey?: string;
    /**
     * Base URL of the API. A trailing `/` is removed.
     * @default "https://api.devupai.com/v1"
     */
    baseURL?: string;
    /**
     * Extra headers sent with every request. An `Authorization` header here is
     * replaced by the key from `apiKey`.
     */
    headers?: Record<string, string>;
    /**
     * Custom `fetch` implementation, for example to add logging or for tests.
     * @default globalThis.fetch
     */
    fetch?: typeof globalThis.fetch;
    /**
     * Model data from `GET /v1/models` (for example `(await client.models.list()).data`).
     *
     * When a model id is listed here, its `supports.structured_output` flag
     * decides how a JSON schema response format is sent: `true` sends the
     * schema as a `json_schema` response format, `false` sends a `json_object`
     * response format. Model ids that are not listed keep the default of the
     * Vercel AI SDK OpenAI-compatible adapter.
     */
    models?: ReadonlyArray<DevupAIModelData>;
}

/**
 * The DEVUP AI integration for the Vercel AI SDK, as returned by
 * {@link createDevupAI}.
 *
 * Callable as a function to create a language model:
 * ```typescript
 * const model = devupai("<model-id>");
 * ```
 */
export interface DevupAIIntegration extends ProviderV4 {
    /**
     * Creates a chat language model (`POST /v1/chat/completions`).
     * @param modelId - A model id from `GET /v1/models`.
     */
    (modelId: string): LanguageModelV4;
    /**
     * Creates a chat language model (`POST /v1/chat/completions`).
     * @param modelId - A model id from `GET /v1/models`.
     */
    languageModel(modelId: string): LanguageModelV4;
    /**
     * Creates a chat language model (`POST /v1/chat/completions`).
     * Same as {@link DevupAIIntegration.languageModel}.
     * @param modelId - A model id from `GET /v1/models`.
     */
    chatModel(modelId: string): LanguageModelV4;
    /**
     * Creates an embedding model (`POST /v1/embeddings`).
     * @param modelId - An embedding model id from `GET /v1/models`.
     */
    embeddingModel(modelId: string): EmbeddingModelV4;
    /**
     * Creates an image model that generates images from a text prompt
     * (`POST /v1/images/generations`). Input images and masks are not accepted
     * here; to edit an image, use `images.edit` of the `devupai` client.
     * @param modelId - An image model id from `GET /v1/models`.
     */
    imageModel(modelId: string): ImageModelV4;
}

/**
 * @deprecated Renamed to {@link DevupAIIntegration}.
 */
export type DevupAIProvider = DevupAIIntegration;

/**
 * @deprecated Renamed to {@link DevupAIIntegrationSettings}.
 */
export type DevupAIProviderSettings = DevupAIIntegrationSettings;

function readEnv(name: string): string | undefined {
    if (typeof process === "undefined" || process.env === undefined) return undefined;
    return process.env[name];
}

function loadApiKey(explicitKey: string | undefined): string {
    const key = explicitKey ?? readEnv("DEVUP_API_KEY") ?? readEnv("DEVUPAI_API_KEY");
    if (key === undefined || key.trim() === "") {
        throw new LoadAPIKeyError({
            message:
                "DEVUP AI API key is missing. Pass `apiKey` to createDevupAI() " +
                "or set the DEVUP_API_KEY environment variable.",
        });
    }
    return key;
}

/** Caller headers without any `Authorization` header (the key comes from `apiKey`). */
function callerHeaders(headers: Record<string, string> | undefined): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [name, value] of Object.entries(headers ?? {})) {
        if (name.toLowerCase() === "authorization") continue;
        result[name] = value;
    }
    return result;
}

/**
 * Wraps `fetch` so every request starts its `User-Agent` with
 * `devupai-node/<version>`. The Vercel AI SDK appends its own tokens to the
 * header per call, so the identity is set here, on the final request.
 */
function withIdentity(baseFetch: typeof globalThis.fetch | undefined): typeof globalThis.fetch {
    const identity = `devupai-node/${VERSION}`;
    return (input, init) => {
        const headers = new Headers(
            init?.headers ?? (input instanceof Request ? input.headers : undefined),
        );
        const current = headers.get("user-agent");
        if (current === null || current === "") {
            headers.set("user-agent", identity);
        } else if (!current.startsWith(identity)) {
            headers.set("user-agent", `${identity} ${current}`);
        }
        const doFetch = baseFetch ?? globalThis.fetch;
        return doFetch(input, { ...init, headers });
    };
}

/**
 * An image model that only generates images from a prompt. A call with input
 * images or a mask is rejected before any request is sent.
 */
class DevupAIImageModel implements ImageModelV4 {
    readonly specificationVersion = "v4";
    readonly supportsFileInputs = false;
    readonly supportsMaskInputs = false;
    private readonly model: ImageModelV4;

    constructor(model: ImageModelV4) {
        this.model = model;
    }

    get provider(): string {
        return this.model.provider;
    }

    get modelId(): string {
        return this.model.modelId;
    }

    get maxImagesPerCall(): ImageModelV4["maxImagesPerCall"] {
        return this.model.maxImagesPerCall;
    }

    async doGenerate(options: ImageModelV4CallOptions): Promise<ImageModelV4Result> {
        if ((options.files !== undefined && options.files.length > 0) || options.mask !== undefined) {
            throw new UnsupportedFunctionalityError({
                functionality: "image editing",
                message:
                    "imageModel generates images from a text prompt. " +
                    "To edit an image, use images.edit of the devupai client.",
            });
        }
        return await this.model.doGenerate(options);
    }
}

/**
 * Creates a DEVUP AI instance for the Vercel AI SDK.
 *
 * Streaming calls request token usage (`stream_options.include_usage`), so
 * `streamText` reports usage from the final chunk.
 *
 * @param settings - API key, base URL, headers, `fetch` and optional model data.
 * @returns A callable that creates language, embedding and image models.
 *
 * @example
 * ```typescript
 * import DevupAI from "devupai";
 * import { createDevupAI } from "devupai/ai";
 * import { embed, generateText, streamText } from "ai";
 *
 * const client = new DevupAI({ apiKey: process.env.DEVUP_API_KEY! });
 * const devupai = createDevupAI({
 *     apiKey: process.env.DEVUP_API_KEY,
 *     models: (await client.models.list()).data, // optional
 * });
 *
 * // Text generation
 * const { text } = await generateText({
 *     model: devupai("<model-id>"),
 *     prompt: "Explain quantum computing",
 * });
 *
 * // Streaming
 * const result = streamText({
 *     model: devupai("<model-id>"),
 *     prompt: "Write a haiku about the sea",
 * });
 * for await (const part of result.textStream) process.stdout.write(part);
 * console.log(await result.usage);
 *
 * // Embeddings
 * const { embedding } = await embed({
 *     model: devupai.embeddingModel("<embedding-model-id>"),
 *     value: "Hello world",
 * });
 * ```
 */
export function createDevupAI(settings: DevupAIIntegrationSettings = {}): DevupAIIntegration {
    const baseURL = (settings.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const headers = callerHeaders(settings.headers);
    const fetch = withIdentity(settings.fetch);

    const structuredOutput = new Map<string, boolean>();
    for (const model of settings.models ?? []) {
        const flag = model.supports?.structured_output;
        if (typeof flag === "boolean" && !structuredOutput.has(model.id)) {
            structuredOutput.set(model.id, flag);
        }
    }

    const createAdapter = (supportsStructuredOutputs: boolean | undefined): OpenAICompatibleProvider =>
        createOpenAICompatible({
            name: "devupai",
            baseURL,
            apiKey: () => loadApiKey(settings.apiKey),
            headers,
            fetch,
            includeUsage: true,
            supportsStructuredOutputs,
        });

    const adapters = new Map<boolean | undefined, OpenAICompatibleProvider>();
    const adapterFor = (supportsStructuredOutputs: boolean | undefined): OpenAICompatibleProvider => {
        let adapter = adapters.get(supportsStructuredOutputs);
        if (adapter === undefined) {
            adapter = createAdapter(supportsStructuredOutputs);
            adapters.set(supportsStructuredOutputs, adapter);
        }
        return adapter;
    };

    const languageModel = (modelId: string): LanguageModelV4 =>
        adapterFor(structuredOutput.get(modelId)).chatModel(modelId);

    return Object.assign((modelId: string): LanguageModelV4 => languageModel(modelId), {
        specificationVersion: "v4" as const,
        languageModel,
        chatModel: languageModel,
        embeddingModel: (modelId: string): EmbeddingModelV4 => adapterFor(undefined).embeddingModel(modelId),
        imageModel: (modelId: string): ImageModelV4 => new DevupAIImageModel(adapterFor(undefined).imageModel(modelId)),
    });
}

/**
 * Default instance. It reads the API key from `DEVUP_API_KEY` (or
 * `DEVUPAI_API_KEY`) when a request is made.
 *
 * @example
 * ```typescript
 * import { devupai } from "devupai/ai";
 * import { generateText } from "ai";
 *
 * const { text } = await generateText({
 *     model: devupai("<model-id>"),
 *     prompt: "Hello!",
 * });
 * ```
 */
export const devupai: DevupAIIntegration = createDevupAI();
