import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { LanguageModelV3, EmbeddingModelV3, ImageModelV3 } from '@ai-sdk/provider';

/**
 * DEVUP AI — Vercel AI SDK Provider
 *
 * Enables usage with the Vercel AI SDK (streamText, generateText, useChat, etc.)
 *
 * @example
 * ```typescript
 * import { createDevupAI } from "devupai/ai";
 * import { streamText } from "ai";
 *
 * const devupai = createDevupAI({ apiKey: "sk-devup-..." });
 * const result = await streamText({
 *   model: devupai("devup-fast-v1"),
 *   prompt: "Hello!",
 * });
 * ```
 *
 * @module
 */

/**
 * Configuration options for the DEVUP AI Vercel AI SDK provider.
 */

export interface DevupAIProviderSettings {
    /**
     * Your DEVUP AI API key. Required — obtain from https://devupai.com/dashboard/api-keys
     */
    apiKey?: string;
    /**
     * Base URL for the DEVUP AI API.
     * @default "https://api.devupai.com/v1"
     */
    baseURL?: string;
    /**
     * Custom headers to include in every request.
     */
    headers?: Record<string, string>;
}

/**
 * DEVUP AI provider interface for the Vercel AI SDK.
 *
 * Callable as a function to create a language model:
 * ```typescript
 * const model = devupai("devup-fast-v1");
 * ```
 */
export interface DevupAIProvider {
    /**
     * Creates a language model for text generation.
     * @param modelId - The DEVUP AI model identifier.
     */
    (modelId: string): LanguageModelV3;
    /**
     * Creates a chat model for text generation.
     * @param modelId - The DEVUP AI model identifier.
     */
    chatModel(modelId: string): LanguageModelV3;
    /**
     * Creates a language model for text generation.
     * @param modelId - The DEVUP AI model identifier.
     */
    languageModel(modelId: string): LanguageModelV3;
    /**
     * Creates a completion model for text generation.
     * @param modelId - The DEVUP AI model identifier.
     */
    completionModel(modelId: string): LanguageModelV3;
    /**
     * Creates an embedding model for text embeddings.
     * @param modelId - The DEVUP AI embedding model identifier.
     */
    embeddingModel(modelId: string): EmbeddingModelV3;
    /**
     * Creates an image model for image generation.
     * @param modelId - The DEVUP AI image model identifier.
     */
    imageModel(modelId: string): ImageModelV3;
}

/**
 * Creates a DEVUP AI provider instance for use with the Vercel AI SDK.
 *
 * @param options - Provider configuration options.
 * @returns A callable provider that creates models for text, embedding, and image generation.
 *
 * @example
 * ```typescript
 * import { createDevupAI } from "devupai/ai";
 * import { generateText, streamText, embed } from "ai";
 *
 * const devupai = createDevupAI({ apiKey: "sk-devup-..." });
 *
 * // Text generation
 * const { text } = await generateText({
 *   model: devupai("devup-fast-v1"),
 *   prompt: "Explain quantum computing",
 * });
 *
 * // Streaming
 * const result = await streamText({
 *   model: devupai("devup-fast-v1"),
 *   prompt: "Write a haiku about AI",
 * });
 *
 * // Embeddings
 * const { embedding } = await embed({
 *   model: devupai.embeddingModel("devup-embed-v1"),
 *   value: "Hello world",
 * });
 * ```
 */
export function createDevupAI(options: DevupAIProviderSettings = {}): DevupAIProvider {
  const baseURL = (options.baseURL ?? "https://api.devupai.com/v1").replace(
    /\/+$/,
    ""
  );
  return createOpenAICompatible({
    baseURL,
    name: "devupai",
    apiKey: options.apiKey ?? (typeof process !== 'undefined' ? (process.env.DEVUP_API_KEY ?? process.env.DEVUPAI_API_KEY) : undefined),
    headers: options.headers
  }) as unknown as DevupAIProvider;
}

/**
 * Default DEVUP AI provider instance (requires apiKey to be set before use).
 *
 * @example
 * ```typescript
 * import { devupai } from "devupai/ai";
 * import { generateText } from "ai";
 *
 * const { text } = await generateText({
 *   model: devupai("devup-fast-v1"),
 *   prompt: "Hello!",
 * });
 * ```
 */
export const devupai: DevupAIProvider = createDevupAI();
