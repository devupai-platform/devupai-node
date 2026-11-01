// D4 — the `devupai/ai` integration with ai@7, against a recording fetch. No network.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createProviderRegistry, embed, generateImage, generateText, jsonSchema, Output, streamText } from "ai";
import { LoadAPIKeyError, UnsupportedFunctionalityError, type ProviderV4 } from "@ai-sdk/provider";
import { createDevupAI, devupai as defaultInstance, type DevupAIIntegration } from "../src/provider";
import { BASE, DONE, MODEL_A, MODEL_B, chunk, dataEvent, jsonResponse, mockFetch, sseResponse, type RecordedRequest } from "./helpers/mock-fetch";

const SDK_VERSION: string = (JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8")) as { version: string }).version;
const KEY = "sk-fixture-key";
const MODEL_C = "fixture/model-c";

function body(req: RecordedRequest | undefined): Record<string, unknown> {
    expect(req).toBeDefined();
    expect(req!.json).toBeTypeOf("object");
    return req!.json as Record<string, unknown>;
}

const chatCompletion = (content: string, model = MODEL_A) => ({
    id: "chatcmpl-fixture",
    object: "chat.completion",
    created: 1_700_000_000,
    model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
});

function expectCommonHeaders(req: RecordedRequest | undefined): void {
    expect(req).toBeDefined();
    expect(req!.method).toBe("POST");
    expect(req!.headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(req!.headers.get("user-agent") ?? "").toMatch(new RegExp(`^devupai-node/${SDK_VERSION.replace(/\./g, "\\.")}(\\s|$)`));
}

describe("devupai/ai with ai@7 (D4, block0 §3.9 item 14)", () => {
    const saved = { a: process.env.DEVUP_API_KEY, b: process.env.DEVUPAI_API_KEY };

    beforeAll(() => {
        // The adapter logs a notice for responseFormat on models without structured output; not needed here.
        (globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;
    });

    beforeEach(() => {
        delete process.env.DEVUP_API_KEY;
        delete process.env.DEVUPAI_API_KEY;
    });

    afterEach(() => {
        if (saved.a === undefined) delete process.env.DEVUP_API_KEY;
        else process.env.DEVUP_API_KEY = saved.a;
        if (saved.b === undefined) delete process.env.DEVUPAI_API_KEY;
        else process.env.DEVUPAI_API_KEY = saved.b;
    });

    it("generateText: POST /chat/completions with the key, User-Agent and caller headers; usage parsed", async () => {
        const f = mockFetch(() => jsonResponse(chatCompletion("Hello there")));
        const devupai = createDevupAI({ apiKey: KEY, fetch: f.fetch, headers: { "X-Fixture": "1", Authorization: "Bearer other" } });
        const result = await generateText({ model: devupai(MODEL_A), prompt: "Hi" });
        expect(f.calls).toHaveLength(1);
        expect(f.calls[0]!.url).toBe(`${BASE}/chat/completions`);
        expectCommonHeaders(f.calls[0]);
        expect(f.calls[0]!.headers.get("x-fixture")).toBe("1");
        const sent = body(f.calls[0]);
        expect(sent.model).toBe(MODEL_A);
        expect(sent.messages).toEqual([{ role: "user", content: "Hi" }]);
        expect(sent.stream).toBeUndefined();
        expect(sent.stream_options).toBeUndefined();
        expect(result.text).toBe("Hello there");
        expect(result.usage.inputTokens).toBe(5);
        expect(result.usage.outputTokens).toBe(3);
        expect(result.usage.totalTokens).toBe(8);
    });

    it("streamText: body has stream_options.include_usage true; usage comes from the final choices: [] chunk", async () => {
        const f = mockFetch(() =>
            sseResponse([
                dataEvent(chunk({ choices: [{ index: 0, delta: { role: "assistant", content: "Hel" }, finish_reason: null }] })),
                dataEvent(chunk({ choices: [{ index: 0, delta: { content: "lo" }, finish_reason: null }] })),
                dataEvent(chunk({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })),
                dataEvent(chunk({ choices: [], usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 } })),
                DONE,
            ]),
        );
        const devupai = createDevupAI({ apiKey: KEY, fetch: f.fetch, baseURL: `${BASE}///` });
        const result = streamText({ model: devupai(MODEL_A), prompt: "Hi" });
        const text = await result.text;
        const usage = await result.usage;
        expect(f.calls).toHaveLength(1);
        expect(f.calls[0]!.url).toBe(`${BASE}/chat/completions`);
        expectCommonHeaders(f.calls[0]);
        const sent = body(f.calls[0]);
        expect(sent.stream).toBe(true);
        expect(sent.stream_options).toEqual({ include_usage: true });
        expect(text).toBe("Hello");
        expect(usage.inputTokens).toBe(11);
        expect(usage.outputTokens).toBe(7);
        expect(usage.totalTokens).toBe(18);
    });

    it("supportsStructuredOutputs follows the passed model data (json_schema only when supports.structured_output is true)", async () => {
        const f = mockFetch(() => jsonResponse(chatCompletion('{"city":"Oran"}')));
        const devupai = createDevupAI({
            apiKey: KEY,
            fetch: f.fetch,
            models: [
                { id: MODEL_A, supports: { structured_output: true } },
                { id: MODEL_B, supports: { structured_output: false } },
            ],
        });
        const schema = jsonSchema<{ city: string }>({
            type: "object",
            properties: { city: { type: "string" } },
            required: ["city"],
            additionalProperties: false,
        });
        const kinds: Record<string, unknown> = {};
        for (const id of [MODEL_A, MODEL_B, MODEL_C]) {
            const before = f.calls.length;
            const r = await generateText({ model: devupai(id), prompt: "City?", output: Output.object({ schema }) });
            expect(r.output).toEqual({ city: "Oran" });
            const format = body(f.calls[before]).response_format as { type?: string } | undefined;
            kinds[id] = format?.type;
        }
        expect(kinds[MODEL_A]).toBe("json_schema");
        expect(kinds[MODEL_B]).toBe("json_object");
        expect(kinds[MODEL_C]).toBe("json_object"); // not listed: adapter default
    });

    it("reads the key lazily from the environment (DEVUP_API_KEY first); a missing key throws before any request", async () => {
        const f = mockFetch(() => jsonResponse(chatCompletion("ok")));
        const devupai = createDevupAI({ fetch: f.fetch });
        await expect(generateText({ model: devupai(MODEL_A), prompt: "Hi", maxRetries: 0 })).rejects.toSatisfy((e: unknown) =>
            LoadAPIKeyError.isInstance(e),
        );
        expect(f.calls).toHaveLength(0);
        process.env.DEVUPAI_API_KEY = "sk-env-second";
        await generateText({ model: devupai(MODEL_A), prompt: "Hi" });
        expect(f.calls[0]!.headers.get("authorization")).toBe("Bearer sk-env-second");
        process.env.DEVUP_API_KEY = "sk-env-first";
        await generateText({ model: devupai(MODEL_A), prompt: "Hi" });
        expect(f.calls[1]!.headers.get("authorization")).toBe("Bearer sk-env-first");
    });

    it("embeddingModel: POST /embeddings", async () => {
        const f = mockFetch(() =>
            jsonResponse({
                object: "list",
                data: [{ object: "embedding", index: 0, embedding: [0.25, 0.5] }],
                model: MODEL_B,
                usage: { prompt_tokens: 2, total_tokens: 2 },
            }),
        );
        const devupai = createDevupAI({ apiKey: KEY, fetch: f.fetch });
        const { embedding } = await embed({ model: devupai.embeddingModel(MODEL_B), value: "hello" });
        expect(f.calls).toHaveLength(1);
        expect(f.calls[0]!.url).toBe(`${BASE}/embeddings`);
        expectCommonHeaders(f.calls[0]);
        expect(body(f.calls[0])).toMatchObject({ model: MODEL_B, input: ["hello"] });
        expect(embedding).toEqual([0.25, 0.5]);
    });

    it("imageModel: generation hits /images/generations; input images or a mask are rejected before any request", async () => {
        const f = mockFetch(() => jsonResponse({ created: 1_700_000_000, data: [{ b64_json: "aGVsbG8=" }] }));
        const devupai = createDevupAI({ apiKey: KEY, fetch: f.fetch });
        const model = devupai.imageModel(MODEL_A);
        const gen = await generateImage({ model, prompt: "a lighthouse" });
        expect(f.calls).toHaveLength(1);
        expect(f.calls[0]!.url).toBe(`${BASE}/images/generations`);
        expectCommonHeaders(f.calls[0]);
        expect(body(f.calls[0])).toMatchObject({ model: MODEL_A, prompt: "a lighthouse" });
        expect(gen.images[0]!.base64).toBe("aGVsbG8=");

        const edit = await generateImage({
            model,
            prompt: { images: [new Uint8Array([137, 80, 78, 71])], text: "edit it" },
            maxRetries: 0,
        }).catch((e: unknown) => e);
        expect(UnsupportedFunctionalityError.isInstance(edit)).toBe(true);

        await expect(
            model.doGenerate({
                prompt: "x",
                n: 1,
                size: undefined,
                aspectRatio: undefined,
                seed: undefined,
                providerOptions: {},
                files: undefined,
                mask: { type: "file", mediaType: "image/png", data: new Uint8Array([1]) },
            }),
        ).rejects.toSatisfy((e: unknown) => UnsupportedFunctionalityError.isInstance(e));
        expect(f.calls).toHaveLength(1);
    });

    it("surface: ai@7 v4 specification, works in a model registry, no completionModel", () => {
        const f = mockFetch(() => jsonResponse(chatCompletion("ok")));
        const devupai = createDevupAI({ apiKey: KEY, fetch: f.fetch });
        const asV4: ProviderV4 = devupai;
        expect(asV4.specificationVersion).toBe("v4");
        const registry = createProviderRegistry({ devupai });
        expect(registry.languageModel(`devupai:${MODEL_A}`).modelId).toBe(MODEL_A);
        expect("completionModel" in devupai).toBe(false);
        // @ts-expect-error completionModel is not part of the 4.x integration
        expect(devupai.completionModel).toBeUndefined();
        expect(devupai.chatModel(MODEL_A).specificationVersion).toBe("v4");
        expect(devupai.languageModel(MODEL_A).modelId).toBe(MODEL_A);
        const d: DevupAIIntegration = defaultInstance; // the default instance builds without a key
        expect(typeof d).toBe("function");
        expect(f.calls).toHaveLength(0);
    });
});
