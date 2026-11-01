// Contract tests: response fixtures validated against the vendored OpenAPI document
// (`openapi/devupai-v1.yaml`, the file `npm run sync:spec` copies and `npm run check:types` checks).
import { describe, it, expect, beforeAll } from "vitest";
import Ajv, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { load } from "js-yaml";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MODEL_A, MODEL_B, REQ_ID } from "./helpers/mock-fetch";

const ROOT = path.join(__dirname, "..");
const SPEC_PATH = path.join(ROOT, "openapi", "devupai-v1.yaml");
const SPEC_ID = "devupai-v1";

interface OpenAPIDocument {
    openapi: string;
    paths: Record<string, unknown>;
    components: { schemas: Record<string, unknown> };
}

const validators: Record<string, ValidateFunction> = {};
let spec: OpenAPIDocument;

function validate(name: string, value: unknown): boolean {
    const fn = validators[name];
    if (!fn) throw new Error(`no validator for ${name}`);
    return fn(value) as boolean;
}

function expectValid(name: string, value: unknown): void {
    const ok = validate(name, value);
    expect(validators[name]!.errors ?? null, name).toBeNull();
    expect(ok).toBe(true);
}

describe("OpenAPI Contract Tests (vendored openapi/devupai-v1.yaml)", () => {
    beforeAll(() => {
        const bytes = readFileSync(SPEC_PATH);
        // The vendored copy must be the one recorded in SPEC_SHA256.
        const recorded = readFileSync(path.join(ROOT, "openapi", "SPEC_SHA256"), "utf8").trim();
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(recorded);

        spec = load(bytes.toString("utf8")) as OpenAPIDocument;
        const ajv = new Ajv({ strict: false, allErrors: true });
        addFormats(ajv);
        ajv.addFormat("double", true);
        ajv.addFormat("binary", true);
        ajv.addSchema({ $id: SPEC_ID, components: spec.components });

        for (const name of [
            "DevUpBilling",
            "ChatCompletionResponse",
            "ChatCompletionChunk",
            "ChatCompletionStreamError",
            "ResponsesResponse",
            "ResponsesStreamEvent",
            "ResponsesStreamErrorEvent",
            "EmbeddingResponse",
            "RerankResponse",
            "ImageGenerationResponse",
            "SpeechResponse",
            "TranscriptionResponse",
            "TranscriptionVerboseResponse",
            "VideoGenerationResponse",
            "ModelListResponse",
            "ModelObject",
            "BalanceResponse",
            "HealthResponse",
            "ErrorResponse",
        ]) {
            validators[name] = ajv.compile({ $ref: `${SPEC_ID}#/components/schemas/${name}` });
        }
    });

    it("documents every endpoint the SDK calls", () => {
        for (const p of [
            "/v1/chat/completions",
            "/v1/responses",
            "/v1/embeddings",
            "/v1/rerank",
            "/v1/images/generations",
            "/v1/images/proxy",
            "/v1/audio/speech",
            "/v1/audio/transcriptions",
            "/v1/video/generations",
            "/v1/models",
            "/v1/models/{model}",
            "/v1/inference/{model_path}",
            "/v1/user/balance",
            "/health",
        ]) {
            expect(spec.paths, p).toHaveProperty([p]);
        }
    });

    describe("Positive Fixtures", () => {
        const model = {
            id: MODEL_A,
            object: "model",
            name: "Fixture model A",
            created: 1700000000,
            owned_by: "fixture",
            type: "text-generation",
            context_window: null,
            is_replaced: false,
            pricing: { unit: "1M tokens", currency: "DZD", input: 1, output: 2 },
            supports: {
                tools: true,
                vision: false,
                reasoning: false,
                structured_output: true,
                audio_input: false,
                video_input: false,
                reasoning_can_be_disabled: false,
                pdf_input: false,
            },
        };

        it("validates DevUpBilling (cost shape and notice shape)", () => {
            expectValid("DevUpBilling", { cost_dzd: 1.5, balance_dzd: 500.0, request_id: REQ_ID });
            expectValid("DevUpBilling", { request_id: REQ_ID, warnings: ["fixture_notice"] });
        });

        it("validates ChatCompletionResponse (with and without _devup)", () => {
            const base = {
                id: "chatcmpl-00000000-0000-4000-8000-000000000000",
                object: "chat.completion",
                created: 1677652288,
                model: MODEL_A,
                service_tier: "default",
                choices: [{ index: 0, message: { role: "assistant", content: "Hello there!" }, finish_reason: "stop", logprobs: null }],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 2,
                    total_tokens: 12,
                    prompt_tokens_details: { cached_tokens: 0 },
                    completion_tokens_details: { reasoning_tokens: 0 },
                },
            };
            expectValid("ChatCompletionResponse", { ...base, _devup: { cost_dzd: 1, balance_dzd: 100, request_id: REQ_ID } });
            expectValid("ChatCompletionResponse", base);
        });

        it("validates the real stream chunk shapes (content chunk, final usage chunk)", () => {
            const head = { id: "chatcmpl-00000000-0000-4000-8000-000000000000", object: "chat.completion.chunk", created: 1700000000, model: MODEL_A };
            expectValid("ChatCompletionChunk", {
                ...head,
                service_tier: null,
                choices: [{ index: 0, delta: { role: "assistant", content: "", reasoning_content: null }, logprobs: null, finish_reason: null }],
            });
            expectValid("ChatCompletionChunk", {
                ...head,
                service_tier: "default",
                choices: [],
                usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12, prompt_tokens_details: { cached_tokens: 0 } },
            });
        });

        it("validates the in-stream error frame", () => {
            expectValid("ChatCompletionStreamError", { error: { message: "The request could not be completed.", type: "devup_error", code: "fixture_conflict" } });
        });

        it("validates Responses objects and stream events", () => {
            const response = {
                id: "resp_fixture",
                object: "response",
                created_at: 1700000000,
                model: MODEL_A,
                status: "completed",
                output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "Hi" }] }],
                usage: { input_tokens: 5, output_tokens: 1, total_tokens: 6 },
                _devup: { cost_dzd: 1, balance_dzd: 99, request_id: REQ_ID },
            };
            expectValid("ResponsesResponse", response);
            expectValid("ResponsesStreamEvent", { type: "response.output_text.delta", sequence_number: 3, delta: "Hi", output_index: 0, content_index: 0, item_id: "msg_1" });
            expectValid("ResponsesStreamEvent", { type: "response.completed", sequence_number: 9, response });
            expectValid("ResponsesStreamErrorEvent", {
                type: "error",
                sequence_number: 10,
                code: "fixture_capacity",
                message: "The request could not be completed.",
                param: null,
                error: { message: "The request could not be completed.", type: "devup_error", code: "fixture_capacity" },
            });
        });

        it("validates EmbeddingResponse (float array and base64 string)", () => {
            expectValid("EmbeddingResponse", {
                object: "list",
                data: [{ object: "embedding", embedding: [0.1, 0.2], index: 0 }],
                model: MODEL_B,
                usage: { prompt_tokens: 5, total_tokens: 5 },
                _devup: { cost_dzd: 1, balance_dzd: 100 },
            });
            expectValid("EmbeddingResponse", {
                object: "list",
                data: [{ object: "embedding", embedding: "AAAAPw==", index: 0 }],
                model: MODEL_B,
            });
        });

        it("validates RerankResponse without documents", () => {
            expectValid("RerankResponse", { object: "list", model: MODEL_B, results: [{ index: 0, relevance_score: 0.5 }], _devup: { cost_dzd: 1, balance_dzd: 2 } });
        });

        it("validates ImageGenerationResponse (url and b64_json)", () => {
            expectValid("ImageGenerationResponse", { created: 1677652288, data: [{ url: "https://example.com/img.png" }], _devup: { cost_dzd: 1, balance_dzd: 100 } });
            expectValid("ImageGenerationResponse", { data: [{ b64_json: "aGVsbG8=" }], _devup: { cost_dzd: 1, balance_dzd: 100 } });
        });

        it("validates SpeechResponse", () => {
            expectValid("SpeechResponse", { url: "https://example.com/audio.mp3", _devup: { cost_dzd: 1, balance_dzd: 500 } });
        });

        it("validates TranscriptionResponse", () => {
            expectValid("TranscriptionResponse", { text: "Hello world", _devup: { request_id: REQ_ID } });
        });

        it("validates TranscriptionVerboseResponse", () => {
            expectValid("TranscriptionVerboseResponse", {
                task: "transcribe",
                language: "english",
                duration: 1.5,
                text: "Hello world",
                segments: [
                    {
                        id: 0,
                        seek: 0,
                        start: 0,
                        end: 1,
                        text: "Hello world",
                        tokens: [1, 2, 3],
                        temperature: 0,
                        avg_logprob: -0.5,
                        compression_ratio: 1,
                        no_speech_prob: 0.1,
                    },
                ],
                words: [{ word: "Hello", start: 0, end: 0.5 }],
                _devup: { cost_dzd: 1, balance_dzd: 2, request_id: REQ_ID },
            });
        });

        it("validates VideoGenerationResponse", () => {
            expectValid("VideoGenerationResponse", { created: 1677652288, data: [{ url: "https://example.com/vid.mp4" }], _devup: { cost_dzd: 1, balance_dzd: 100 } });
        });

        it("validates ModelListResponse and ModelObject", () => {
            expectValid("ModelObject", model);
            expectValid("ModelListResponse", { object: "list", data: [model, { ...model, id: MODEL_B, context_window: 8192, pricing: { ...model.pricing, cached: 0.5 } }] });
        });

        it("validates BalanceResponse", () => {
            expectValid("BalanceResponse", { balance_dzd: 1000.5 });
        });

        it("validates HealthResponse", () => {
            expectValid("HealthResponse", { status: "ok" });
        });

        it("validates ErrorResponse", () => {
            expectValid("ErrorResponse", { error: { message: "An error occurred", type: "devup_error", code: "fixture_invalid" } });
        });
    });

    describe("Negative Fixtures", () => {
        it("rejects Billing with a non-numeric cost_dzd", () => {
            expect(validate("DevUpBilling", { cost_dzd: "1.5", balance_dzd: 500.0 })).toBe(false);
        });

        it("rejects Billing with a malformed request_id", () => {
            expect(validate("DevUpBilling", { request_id: "req-123" })).toBe(false);
        });

        it("rejects Chat missing required fields", () => {
            expect(validate("ChatCompletionResponse", { id: "chatcmpl-123" })).toBe(false);
        });

        it("rejects a chunk without choices", () => {
            expect(validate("ChatCompletionChunk", { id: "chatcmpl-1", object: "chat.completion.chunk", created: 1, model: MODEL_A })).toBe(false);
        });

        it("rejects Transcription missing _devup", () => {
            expect(validate("TranscriptionResponse", { text: "Hello world" })).toBe(false);
        });

        it("rejects Verbose transcription missing text", () => {
            expect(validate("TranscriptionVerboseResponse", { task: "transcribe", language: "english", duration: 1.5, _devup: {} })).toBe(false);
        });

        it("rejects Video using video_url instead of url", () => {
            expect(validate("VideoGenerationResponse", { created: 1677652288, data: [{ video_url: "https://example.com/vid.mp4" }], _devup: {} })).toBe(false);
        });

        it("rejects Video missing data", () => {
            expect(validate("VideoGenerationResponse", { created: 1677652288, _devup: {} })).toBe(false);
        });

        it("rejects Video item missing url", () => {
            expect(validate("VideoGenerationResponse", { created: 1677652288, data: [{}], _devup: {} })).toBe(false);
        });

        it("rejects Error missing code", () => {
            expect(validate("ErrorResponse", { error: { message: "An error occurred", type: "devup_error" } })).toBe(false);
        });

        it("rejects Invalid enum values", () => {
            expect(
                validate("ChatCompletionResponse", {
                    id: "chatcmpl-123",
                    object: "invalid.enum.value",
                    created: 1677652288,
                    model: MODEL_A,
                    choices: [{ index: 0, message: { role: "assistant", content: "Hello there!" }, finish_reason: "stop" }],
                }),
            ).toBe(false);
        });

        it("rejects a model with an unknown supports flag", () => {
            expect(validate("ModelObject", { id: MODEL_A, object: "model", supports: { fixture_flag: true } })).toBe(false);
        });
    });
});
