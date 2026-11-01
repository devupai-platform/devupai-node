// Type tests, checked by `tsc --noEmit -p tsconfig.test.json` (lines marked @ts-expect-error must NOT compile).
// The runtime part only makes sure the file loads; the checks are done by the compiler.
import { describe, expect, expectTypeOf, it } from "vitest";
import DevupAI, {
    Stream,
    type APIPromise,
    type ChatCompletion,
    type ChatCompletionChunk,
    type ChatCompletionCreateParams,
    type ChatCompletionDeltaChunk,
    type DevUpBilling,
    type DevupAPIError,
    type EmbeddingCreateResponse,
    type ErrorResponse,
    type ModelObject,
    type RerankCreateParams,
    type ResponseObject,
    type ResponseStreamEvent,
    type TokenUsage,
    type TranscriptionResponse,
    type TranscriptionVerboseResponse,
    type WithResponse,
} from "../src/index";
// @ts-expect-error ChatCompletionBillingChunk was removed in 4.0.0 (block0 §3.9 item 4)
import type { ChatCompletionBillingChunk } from "../src/index";
import { createDevupAI } from "../src/provider";
import { MODEL_A, MODEL_B, TEST_KEY } from "./helpers/mock-fetch";

/** Compile-only: never called. */
function typeChecks(client: DevupAI): void {
    // Defect 2: stream_options compiles and selects the stream overload.
    const streamPromise = client.chat.completions.create({
        model: MODEL_A,
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
        stream_options: { include_usage: true },
    });
    expectTypeOf(streamPromise).toEqualTypeOf<APIPromise<Stream<ChatCompletionChunk>>>();

    const params: ChatCompletionCreateParams = { model: MODEL_A, messages: [], stream_options: { include_usage: true } };
    void params;

    // Non-stream overload.
    const jsonPromise = client.chat.completions.create({ model: MODEL_A, messages: [] });
    expectTypeOf(jsonPromise).toEqualTypeOf<APIPromise<ChatCompletion>>();
    expectTypeOf(jsonPromise.withResponse()).toEqualTypeOf<Promise<WithResponse<ChatCompletion>>>();

    // Defect 3: usage on the chunk without a cast; service_tier, system_fingerprint typed.
    const onChunk = (chunk: ChatCompletionChunk): number | undefined => {
        const tier: string | null | undefined = chunk.service_tier;
        const fp: string | undefined = chunk.system_fingerprint;
        void tier;
        void fp;
        return chunk.usage?.total_tokens;
    };
    void onChunk;
    expectTypeOf<ChatCompletionChunk["usage"]>().toEqualTypeOf<TokenUsage | undefined>();
    expectTypeOf<ChatCompletionChunk["_devup"]>().toEqualTypeOf<DevUpBilling | undefined>();

    // Defect 4: "_devup" in chunk does not narrow to a billing-only member: choices stay available.
    const narrow = (chunk: ChatCompletionChunk): ChatCompletionChunk["choices"] => {
        if ("_devup" in chunk) return chunk.choices;
        return chunk.choices;
    };
    void narrow;

    // The deprecated alias is the same single type.
    expectTypeOf<ChatCompletionDeltaChunk>().toEqualTypeOf<ChatCompletionChunk>();

    // TokenUsage: no top-level reasoning_tokens.
    const usage: TokenUsage = {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
        // @ts-expect-error reasoning_tokens lives in completion_tokens_details
        reasoning_tokens: 1,
    };
    void usage;

    // DevUpBilling: every field optional.
    const billing: DevUpBilling = {};
    void billing;
    const chat: ChatCompletion = { id: "x", object: "chat.completion", created: 1, model: MODEL_A, choices: [] };
    expectTypeOf(chat._devup).toEqualTypeOf<DevUpBilling | undefined>();

    // ModelObject.owned_by is a plain string.
    expectTypeOf<ModelObject["owned_by"]>().toEqualTypeOf<string>();

    // Rerank: return_documents is optional.
    const rerank: RerankCreateParams = { model: MODEL_B, query: "q", documents: ["a"] };
    void client.rerank.create(rerank);

    // Embeddings: number[] or a base64 string.
    expectTypeOf<NonNullable<EmbeddingCreateResponse["data"][number]["embedding"]>>().toEqualTypeOf<number[] | string>();

    // Transcriptions: overloads follow response_format; _devup and verbose fields are typed.
    const file = new Blob();
    expectTypeOf(client.audio.transcriptions.create({ file, response_format: "text" })).toEqualTypeOf<APIPromise<string>>();
    expectTypeOf(client.audio.transcriptions.create({ file, response_format: "verbose_json" })).toEqualTypeOf<APIPromise<TranscriptionVerboseResponse>>();
    expectTypeOf(client.audio.transcriptions.create({ file })).toEqualTypeOf<APIPromise<TranscriptionResponse>>();
    expectTypeOf<TranscriptionResponse["_devup"]>().toEqualTypeOf<DevUpBilling>();
    const verbose = (r: TranscriptionVerboseResponse): string | undefined => r.words?.[0]?.word ?? r.language ?? r.task;
    void verbose;

    // Responses: JSON and stream overloads, typed events.
    expectTypeOf(client.responses.create({ model: MODEL_A, input: "Hi" })).toEqualTypeOf<APIPromise<ResponseObject>>();
    expectTypeOf(client.responses.create({ model: MODEL_A, input: "Hi", stream: true })).toEqualTypeOf<APIPromise<Stream<ResponseStreamEvent>>>();
    const onEvent = (event: ResponseStreamEvent): string | undefined => {
        if (event.type === "error") {
            const code: string = event.code;
            return code;
        }
        return event.delta;
    };
    void onEvent;

    // models.retrieve and images.download signatures.
    expectTypeOf(client.models.retrieve(MODEL_A)).toEqualTypeOf<APIPromise<ModelObject>>();
    expectTypeOf(client.images.download("https://api.devupai.com/v1/images/proxy?d=a&s=b")).toEqualTypeOf<APIPromise<Response>>();
    expectTypeOf(client.images.download("https://api.devupai.com/v1/images/proxy?d=a&s=b", { headers: { Range: "bytes=0-1" } })).toEqualTypeOf<APIPromise<Response>>();
    // @ts-expect-error images.download takes the URL string, not the 3.x { url } object
    void client.images.download({ url: "https://example.com/a.png" });
    // @ts-expect-error images.proxy was renamed to images.download in 4.0.0 (D18), with no alias
    void client.images.proxy;

    // Error code is a plain string, never a union of codes.
    expectTypeOf<DevupAPIError["code"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ErrorResponse["error"]["code"]>().toEqualTypeOf<string>();

    // Request options: second argument, or mixed into params (3.x).
    void client.balance.retrieve({ timeout: 1, maxRetries: 0, headers: { "X-A": "1" }, signal: null });
    void client.chat.completions.create({ model: MODEL_A, messages: [], timeout: 1 }, { streamIdleTimeout: 5 });

    // The ai integration has no completionModel.
    const integration = createDevupAI({ apiKey: TEST_KEY, models: [{ id: MODEL_A, supports: { structured_output: true } }] });
    // @ts-expect-error completionModel was removed in 4.0.0
    void integration.completionModel;
}

describe("type tests (compile-time; see tsconfig.test.json)", () => {
    it("the type-check module loads", () => {
        expect(typeof typeChecks).toBe("function");
        expect(Stream).toBeDefined();
        const unused: ChatCompletionBillingChunk | undefined = undefined;
        expect(unused).toBeUndefined();
    });
});
