import { LanguageModelV3, EmbeddingModelV3, ImageModelV3 } from '@ai-sdk/provider';
import { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';

/**
 * DEVUP AI — Vercel AI SDK Provider
 *
 * Enables usage with the Vercel AI SDK (streamText, generateText, useChat, etc.)
 *
 * @example
 * ```typescript
 * import { createDevupAI } from "devupai";
 * import { streamText } from "ai";
 *
 * const devupai = createDevupAI({ apiKey: "dvup_..." });
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
interface DevupAIProviderSettings {
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
interface DevupAIProvider extends OpenAICompatibleProvider<string, string, string, string> {
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
 * import { createDevupAI } from "devupai";
 * import { generateText, streamText, embed } from "ai";
 *
 * const devupai = createDevupAI({ apiKey: "dvup_..." });
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
declare function createDevupAI(options?: DevupAIProviderSettings): DevupAIProvider;
/**
 * Default DEVUP AI provider instance (requires apiKey to be set before use).
 *
 * @example
 * ```typescript
 * import { devupai } from "devupai";
 * import { generateText } from "ai";
 *
 * const { text } = await generateText({
 *   model: devupai("devup-fast-v1"),
 *   prompt: "Hello!",
 * });
 * ```
 */
declare const devupai: DevupAIProvider;

export { type DevupAIProvider, type DevupAIProviderSettings, createDevupAI, devupai };
