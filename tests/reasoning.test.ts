import { describe, it, expect } from "vitest";
import type { ChatCompletion, ChatCompletionMessage, TokenUsage, ChatCompletionChunkDelta } from "../src/index";
import { MODEL_A, MODEL_B } from "./helpers/mock-fetch";

describe("Reasoning and Token Usage Type & Shape Tests", () => {
    it("allows non-streaming ChatCompletion with populated reasoning_content and reasoning_tokens", () => {
        const response: ChatCompletion = {
            id: "chatcmpl-reasoning-1",
            object: "chat.completion",
            created: 1700000000,
            model: MODEL_A,
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: "The final answer is 42.",
                        reasoning_content: "Step 1: calculate intermediate value... Step 2: conclude 42.",
                    },
                    finish_reason: "stop",
                },
            ],
            usage: {
                prompt_tokens: 20,
                completion_tokens: 150,
                total_tokens: 170,
                prompt_tokens_details: {
                    cached_tokens: 8,
                },
                completion_tokens_details: {
                    reasoning_tokens: 104,
                },
            },
            _devup: {
                cost_dzd: 0.05,
                balance_dzd: 499.95,
            },
        };

        expect(response.choices[0]?.message?.reasoning_content).toBe("Step 1: calculate intermediate value... Step 2: conclude 42.");
        expect(response.usage?.completion_tokens_details?.reasoning_tokens).toBe(104);
        expect(response.usage?.prompt_tokens_details?.cached_tokens).toBe(8);
    });

    it("allows non-streaming ChatCompletion when reasoning_content is null, without _devup and reasoning details", () => {
        const response: ChatCompletion = {
            id: "chatcmpl-reasoning-2",
            object: "chat.completion",
            created: 1700000000,
            model: MODEL_B,
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: "Truncated answer due to max_tokens reached...",
                        reasoning_content: null,
                    },
                    finish_reason: "length",
                },
            ],
            usage: {
                prompt_tokens: 30,
                completion_tokens: 600,
                total_tokens: 630,
            },
        };

        expect(response.choices[0]?.message?.reasoning_content).toBeNull();
        expect(response.choices[0]?.finish_reason).toBe("length");
        expect(response.usage?.completion_tokens_details?.reasoning_tokens).toBeUndefined();
        expect(response.usage?.prompt_tokens_details).toBeUndefined();
        expect(response._devup).toBeUndefined();
    });

    it("handles ChatCompletionMessage with optional and nullable reasoning_content", () => {
        const msgWithReasoning: ChatCompletionMessage = {
            role: "assistant",
            content: "Result text",
            reasoning_content: "Chain of thought...",
        };

        const msgWithNullReasoning: ChatCompletionMessage = {
            role: "assistant",
            content: "Result text",
            reasoning_content: null,
        };

        const msgWithoutReasoning: ChatCompletionMessage = {
            role: "assistant",
            content: "Result text",
        };

        expect(msgWithReasoning.reasoning_content).toBe("Chain of thought...");
        expect(msgWithNullReasoning.reasoning_content).toBeNull();
        expect(msgWithoutReasoning.reasoning_content).toBeUndefined();
    });

    it("handles TokenUsage with optional completion details and nullable prompt_tokens_details", () => {
        const usageWithAll: TokenUsage = {
            prompt_tokens: 10,
            completion_tokens: 50,
            total_tokens: 60,
            prompt_tokens_details: {
                cached_tokens: 4,
            },
            completion_tokens_details: {
                reasoning_tokens: 35,
            },
        };

        const usageNullDetails: TokenUsage = {
            prompt_tokens: 10,
            completion_tokens: 50,
            total_tokens: 60,
            prompt_tokens_details: null,
            completion_tokens_details: null,
        };

        const usageMinimal: TokenUsage = {
            prompt_tokens: 10,
            completion_tokens: 50,
            total_tokens: 60,
        };

        expect(usageWithAll.completion_tokens_details?.reasoning_tokens).toBe(35);
        expect(usageNullDetails.prompt_tokens_details).toBeNull();
        expect(usageMinimal.completion_tokens_details).toBeUndefined();
    });

    it("handles streaming ChatCompletionChunkDelta with reasoning_content", () => {
        const deltaWithReasoning: ChatCompletionChunkDelta = {
            role: "assistant",
            content: null,
            reasoning_content: "Thinking step...",
        };

        const deltaWithContent: ChatCompletionChunkDelta = {
            content: "Hello",
            reasoning_content: null,
        };

        const deltaPlain: ChatCompletionChunkDelta = {
            content: "world",
        };

        expect(deltaWithReasoning.reasoning_content).toBe("Thinking step...");
        expect(deltaWithContent.reasoning_content).toBeNull();
        expect(deltaPlain.reasoning_content).toBeUndefined();
    });
});
