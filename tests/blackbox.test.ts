import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import DevupAI, { DevupAPIError, AuthenticationError, type VideoKeyPoint } from "../src/index";

import * as rootExports from "../src/index";
import * as aiExports from "../src/provider";
import {
    BASE,
    MODEL_A,
    MODEL_B,
    REQ_ID,
    TEST_KEY,
    errorResponse,
    jsonResponse,
    mockFetch,
    realChatStream,
    sseResponse,
    type MockFetch,
    type RecordedRequest,
} from "./helpers/mock-fetch";

const BILLING = { cost_dzd: 1, balance_dzd: 99, request_id: REQ_ID };

/** Answers like the API for each path, so every test can assert what was sent. */
function apiHandler(req: RecordedRequest): Response {
    const url = new URL(req.url);
    if (url.pathname.endsWith("/images/proxy")) {
        return new Response(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), { status: 200, headers: { "content-type": "image/jpeg" } });
    }
    if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
        return jsonResponse({ status: "ok" });
    }
    if (url.pathname.endsWith("/chat/completions")) {
        const body = req.json as { stream?: boolean } | undefined;
        if (body?.stream) return sseResponse(realChatStream());
        return jsonResponse({
            id: "chatcmpl-00000000-0000-4000-8000-000000000000",
            object: "chat.completion",
            created: 1700000000,
            model: MODEL_A,
            choices: [{ index: 0, message: { role: "assistant", content: "Hello" }, finish_reason: "stop" }],
            _devup: BILLING,
        });
    }
    if (url.pathname.endsWith("/audio/transcriptions") && req.form) {
        const format = req.form.get("response_format");
        if (format === "text" || format === "srt" || format === "vtt") {
            return new Response("Text response", { status: 200, headers: { "content-type": "text/plain" } });
        }
        return jsonResponse({ text: "Text response", _devup: BILLING });
    }
    if (url.pathname.endsWith("/models")) {
        return jsonResponse({ object: "list", data: [] });
    }
    if (url.pathname.endsWith("/user/balance")) {
        return jsonResponse({ balance_dzd: 99 });
    }
    if (url.pathname.endsWith("/rerank")) {
        return jsonResponse({ object: "list", model: MODEL_B, results: [{ index: 0, relevance_score: 0.9, document: "doc" }], _devup: BILLING });
    }
    if (url.pathname.endsWith("/embeddings")) {
        return jsonResponse({ object: "list", model: MODEL_B, data: [{ object: "embedding", index: 0, embedding: [0.1, 0.2] }], _devup: BILLING });
    }
    if (url.pathname.endsWith("/audio/speech")) {
        return jsonResponse({ url: "https://api.devupai.com/v1/images/proxy?d=a&s=b", _devup: BILLING });
    }
    if (url.pathname.endsWith("/video/generations") || url.pathname.endsWith("/images/generations")) {
        return jsonResponse({ created: 1700000000, data: [{ url: "https://example.com/vid.mp4" }], _devup: BILLING });
    }
    return jsonResponse({ ok: true, _devup: BILLING });
}

describe("DEVUP AI SDK 4.x - Black-box Tests", () => {
    let mock: MockFetch;
    let client: DevupAI;

    beforeEach(() => {
        mock = mockFetch(apiHandler);
        client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, headers: { "X-Global": "true" } });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe("Constructors and Configuration", () => {
        it("handles default base URL", () => {
            const c = new DevupAI({ apiKey: TEST_KEY });
            expect(c.baseURL).toBe("https://api.devupai.com/v1");
        });

        it("handles custom base URL", () => {
            const c = new DevupAI({ apiKey: TEST_KEY, baseURL: "http://localhost/api/v1" });
            expect(c.baseURL).toBe("http://localhost/api/v1");
        });

        it("removes trailing slashes from baseURL", () => {
            const c = new DevupAI({ apiKey: TEST_KEY, baseURL: "http://localhost/api/v1/" });
            expect(c.baseURL).toBe("http://localhost/api/v1");
        });

        it("uses the global fetch when no fetch option is given", async () => {
            const global = mockFetch(apiHandler);
            vi.stubGlobal("fetch", global.fetch);
            const c = new DevupAI({ apiKey: TEST_KEY });
            await c.balance.retrieve();
            expect(global.calls).toHaveLength(1);
            expect(global.last().url).toBe(`${BASE}/user/balance`);
        });
    });

    describe("Health URL Resolution", () => {
        it("resolves from default base URL", async () => {
            await client.health.check();
            expect(mock.last().url).toBe("https://api.devupai.com/health");
            expect(mock.last().method).toBe("GET");
        });

        it("resolves from a custom base URL with a path", async () => {
            const c = new DevupAI({ apiKey: TEST_KEY, baseURL: "http://localhost:3000/api/v1/", fetch: mock.fetch });
            await c.health.check();
            expect(mock.last().url).toBe("http://localhost:3000/api/health");
        });
    });

    describe("Authorization (block0 §3.9 item 1)", () => {
        it("models.list sends Authorization: Bearer <apiKey>", async () => {
            await client.models.list();
            const req = mock.last();
            expect(req.method).toBe("GET");
            expect(req.url).toBe(`${BASE}/models`);
            expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
            expect(req.body).toBeNull();
        });

        it("a 401 from /models surfaces as DevupAPIError with status and code", async () => {
            const m = mockFetch(() => errorResponse(401, "missing_api_key", "Provide your API key.", { "x-request-id": REQ_ID }));
            const c = new DevupAI({ apiKey: TEST_KEY, fetch: m.fetch });
            const err = await c.models.list().catch((e: unknown) => e);
            expect(err).toBeInstanceOf(DevupAPIError);
            expect(err).toBeInstanceOf(AuthenticationError);
            const apiErr = err as DevupAPIError;
            expect(apiErr.status).toBe(401);
            expect(apiErr.code).toBe("missing_api_key");
            expect(apiErr.requestId).toBe(REQ_ID);
            expect(m.calls).toHaveLength(1);
            expect(m.last().headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
        });

        it("health.check and images.download never send Authorization, even when the caller sets one", async () => {
            const c = new DevupAI({
                apiKey: TEST_KEY,
                fetch: mock.fetch,
                headers: { Authorization: "Bearer caller", "X-Global": "true" },
            });
            await c.health.check({ headers: { authorization: "Bearer per-call" } });
            expect(mock.last().headers.has("authorization")).toBe(false);
            expect(mock.last().headers.get("x-global")).toBe("true");

            await c.images.download(`${BASE}/images/proxy?d=token&s=signature`, { headers: { AuThOrIzAtIoN: "Bearer per-call" } });
            expect(mock.last().headers.has("authorization")).toBe(false);
            expect(mock.last().url).toBe(`${BASE}/images/proxy?d=token&s=signature`);
        });

        it("custom headers cannot override authenticated Authorization (any case)", async () => {
            await client.balance.retrieve({ headers: { Authorization: "Bearer hacked", authorization: "Bearer hacked" } });
            expect(mock.last().headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);

            const c = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, headers: { AUTHORIZATION: "Bearer hacked" } });
            await c.models.list();
            expect(mock.last().headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
        });
    });

    describe("Request headers", () => {
        it("custom headers cannot override JSON Content-Type", async () => {
            await client.chat.completions.create(
                { model: MODEL_A, messages: [] },
                { headers: { "Content-Type": "text/plain", "content-type": "text/plain" } },
            );
            const req = mock.last();
            expect(req.headers.get("content-type")).toBe("application/json");
            expect(req.headers.has("accept")).toBe(true);
            expect(req.json).toEqual({ model: MODEL_A, messages: [] });
        });

        it("multipart Content-Type is never manually forwarded", async () => {
            const blob = new Blob(["img"]);
            await client.images.edit({ model: MODEL_A, image: blob, prompt: "test" }, { headers: { "Content-Type": "multipart/form-data", "content-type": "multipart/form-data" } });
            const req = mock.last();
            expect(req.form).toBeInstanceOf(FormData);
            expect(req.headers.has("content-type")).toBe(false);
        });

        it("client headers and per-call headers are both sent", async () => {
            await client.balance.retrieve({ headers: { "X-Local": "yes" } });
            const req = mock.last();
            expect(req.headers.get("x-global")).toBe("true");
            expect(req.headers.get("x-local")).toBe("yes");
        });
    });

    describe("Resource Methods", () => {
        it("key_points string is appended unchanged", async () => {
            const videoBlob = new Blob(["vid"]);
            await client.video.edits.create({ model: MODEL_A, video: videoBlob, key_points: '{"a":1,"b":"2"}' });
            expect(mock.last().form?.get("key_points")).toBe('{"a":1,"b":"2"}');
        });

        it("key_points typed array is encoded exactly once", async () => {
            const videoBlob = new Blob(["vid"]);
            const points: VideoKeyPoint[] = [{ x: 1, y: 2, type: "positive" }];
            await client.video.edits.create({ model: MODEL_A, video: videoBlob, key_points: points });
            expect(mock.last().form?.get("key_points")).toBe(JSON.stringify(points));
        });

        it("balance.retrieve exact URL, method and key", async () => {
            const result = await client.balance.retrieve();
            const req = mock.last();
            expect(req.url).toBe(`${BASE}/user/balance`);
            expect(req.method).toBe("GET");
            expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
            expect(req.headers.get("x-global")).toBe("true");
            expect(result.balance_dzd).toBe(99);
        });

        it("images.edit sends multipart to /images/generations", async () => {
            const blob = new Blob(["img"]);
            await client.images.edit({ image: blob, prompt: "test", model: MODEL_A, response_format: "b64_json" }, { headers: { "X-Test": "1" } });
            const req = mock.last();
            expect(req.url).toBe(`${BASE}/images/generations`);
            expect(req.method).toBe("POST");
            expect(req.form).toBeInstanceOf(FormData);
            expect(req.form?.get("prompt")).toBe("test");
            expect(req.form?.get("model")).toBe(MODEL_A);
            expect(req.form?.get("response_format")).toBe("b64_json");
            expect(req.form?.get("image")).toBeInstanceOf(Blob);
            expect(req.headers.get("x-test")).toBe("1");
            expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
        });

        it("rerank.create hits /rerank and sends correct JSON payload", async () => {
            const response = await client.rerank.create(
                {
                    model: MODEL_B,
                    query: "What is DEVUP AI?",
                    documents: ["DEVUP AI is an API platform"],
                    top_n: 1,
                    return_documents: true,
                },
                { headers: { "X-Rerank": "test" } },
            );
            const req = mock.last();
            expect(req.url).toBe(`${BASE}/rerank`);
            expect(req.method).toBe("POST");
            expect(req.json).toEqual({
                model: MODEL_B,
                query: "What is DEVUP AI?",
                documents: ["DEVUP AI is an API platform"],
                top_n: 1,
                return_documents: true,
            });
            expect(req.headers.get("x-rerank")).toBe("test");
            expect(req.headers.get("x-global")).toBe("true");
            expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
            expect(response).toHaveProperty("_devup");
        });

        it("video.edits sends multipart to /video/generations with all fields", async () => {
            const videoBlob = new Blob(["vid"]);
            const maskBlob = new Blob(["mask"]);
            const points: VideoKeyPoint[] = [{ x: 1, y: 1, type: "negative" }];
            const response = await client.video.edits.create(
                {
                    model: MODEL_A,
                    video: videoBlob,
                    prompt: "test",
                    mask: maskBlob,
                    mask_url: "http://mask",
                    key_points: points,
                    frame_index: 0,
                    auto_trim: false,
                    preserve_audio: false,
                    background_color: "#000",
                    desired_increase: 2,
                    output_container_and_codec: "mp4",
                    response_format: "url",
                },
                { headers: { "X-Local": "yes" } },
            );
            const req = mock.last();
            expect(req.url).toBe(`${BASE}/video/generations`);
            expect(req.method).toBe("POST");
            expect(req.form).toBeInstanceOf(FormData);

            const formData = req.form!;
            expect(formData.get("video")).toBeInstanceOf(Blob);
            expect(formData.get("mask")).toBeInstanceOf(Blob);
            expect(formData.get("prompt")).toBe("test");
            expect(formData.get("mask_url")).toBe("http://mask");
            expect(formData.get("key_points")).toBe(JSON.stringify(points));
            expect(formData.get("frame_index")).toBe("0"); // zero preserved
            expect(formData.get("auto_trim")).toBe("false"); // false preserved
            expect(formData.get("preserve_audio")).toBe("false"); // false preserved
            expect(formData.get("background_color")).toBe("#000");
            expect(formData.get("model")).toBe(MODEL_A);
            expect(formData.get("desired_increase")).toBe("2");
            expect(formData.get("output_container_and_codec")).toBe("mp4");
            expect(formData.get("response_format")).toBe("url");

            expect(req.headers.get("x-global")).toBe("true");
            expect(req.headers.get("x-local")).toBe("yes");
            expect(req.headers.has("content-type")).toBe(false);

            // `url`, never `video_url`
            const item = response.data[0] as Record<string, unknown>;
            expect(item.url).toBe("https://example.com/vid.mp4");
            expect(item.video_url).toBeUndefined();
        });

        it("audio.speech.create sends JSON and returns the url and _devup", async () => {
            const response = await client.audio.speech.create({ model: MODEL_A, input: "test", voice: "fixture-voice" });
            const req = mock.last();
            expect(req.url).toBe(`${BASE}/audio/speech`);
            expect(req.method).toBe("POST");
            expect(req.json).toEqual({ model: MODEL_A, input: "test", voice: "fixture-voice" });
            expect(response).toHaveProperty("url");
            expect(response).toHaveProperty("_devup");
        });

        it("audio.transcriptions.create text format", async () => {
            const response = await client.audio.transcriptions.create({ model: MODEL_A, file: new Blob(["test"]), response_format: "text" });
            expect(typeof response).toBe("string");
            expect(response).toBe("Text response");
            const req = mock.last();
            expect(req.url).toBe(`${BASE}/audio/transcriptions`);
            expect(req.method).toBe("POST");
            expect(req.form?.get("response_format")).toBe("text");
            expect(req.form?.get("model")).toBe(MODEL_A);
            expect(req.form?.get("file")).toBeInstanceOf(Blob);
        });

        it("audio.transcriptions.create srt format", async () => {
            const response = await client.audio.transcriptions.create({ model: MODEL_A, file: new Blob(["test"]), response_format: "srt" });
            expect(typeof response).toBe("string");
            expect(response).toBe("Text response");
        });

        it("audio.transcriptions.create json format", async () => {
            const response = await client.audio.transcriptions.create({ model: MODEL_A, file: new Blob(["test"]), response_format: "json" });
            expect(typeof response).toBe("object");
            expect(response.text).toBe("Text response");
            expect(response._devup?.request_id).toBe(REQ_ID);
        });

        it("inference.run handles slash in model path", async () => {
            await client.inference.run(MODEL_A, { test: true });
            const req = mock.last();
            expect(req.url).toBe(`${BASE}/inference/fixture%2Fmodel-a`);
            expect(req.method).toBe("POST");
            expect(req.json).toEqual({ test: true });
            expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
        });

        it("inference.run handles already percent-encoded model path", async () => {
            await client.inference.run("fixture%2Fmodel-a", { test: true });
            // Should not double encode
            expect(mock.last().url).toBe(`${BASE}/inference/fixture%2Fmodel-a`);
        });

        it("embeddings.create uses correct path and payload", async () => {
            const response = await client.embeddings.create({ model: MODEL_B, input: "Test input" });
            const req = mock.last();
            expect(req.url).toBe(`${BASE}/embeddings`);
            expect(req.method).toBe("POST");
            expect(req.json).toEqual({ model: MODEL_B, input: "Test input" });
            expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
            expect(response).toHaveProperty("_devup");
        });

        it("images.generate uses correct path and payload", async () => {
            const response = await client.images.generate({ model: MODEL_A, prompt: "A test image" });
            const req = mock.last();
            expect(req.url).toBe(`${BASE}/images/generations`);
            expect(req.method).toBe("POST");
            expect(req.json).toEqual({ model: MODEL_A, prompt: "A test image" });
            expect(req.headers.get("content-type")).toBe("application/json");
            expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
            expect(response).toHaveProperty("_devup");
        });

        it("models.list uses correct path", async () => {
            const response = await client.models.list();
            expect(mock.last().url).toBe(`${BASE}/models`);
            expect(mock.last().method).toBe("GET");
            expect(response.object).toBe("list");
        });

        it("chat.completions.create stream yields the real chunk shape (no _devup chunk)", async () => {
            const stream = await client.chat.completions.create({ model: MODEL_A, messages: [{ role: "user", content: "Hi" }], stream: true });
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            expect(chunks).toHaveLength(4);
            expect(chunks.some((c) => "_devup" in c)).toBe(false);
            const last = chunks[chunks.length - 1]!;
            expect(last.choices).toEqual([]);
            expect(last.usage?.total_tokens).toBe(12);
            expect(mock.last().json).toMatchObject({ stream: true });
        });

        it("plain-text error parsing", async () => {
            const m = mockFetch(() => new Response("Plain text error message", { status: 400, headers: { "Content-Type": "text/plain", "X-Request-Id": "req-123" } }));
            const c = new DevupAI({ apiKey: TEST_KEY, fetch: m.fetch });
            const caughtErr = await c.balance.retrieve().catch((e: unknown) => e);
            expect(caughtErr).toBeInstanceOf(DevupAPIError);
            const err = caughtErr as DevupAPIError;
            expect(err.message).toBe("Plain text error message");
            expect(err.requestId).toBe("req-123");
            expect(err.status).toBe(400);
            expect(err.headers).not.toHaveProperty("authorization");
        });

        it("JSON error parsing", async () => {
            const m = mockFetch(() => jsonResponse({ error: { message: "JSON error message", type: "test", code: "test_code" } }, { status: 400 }));
            const c = new DevupAI({ apiKey: TEST_KEY, fetch: m.fetch });
            const caughtErr = await c.balance.retrieve().catch((e: unknown) => e);
            expect(caughtErr).toBeInstanceOf(DevupAPIError);
            const err = caughtErr as DevupAPIError;
            expect(err.message).toBe("JSON error message");
            expect(err.type).toBe("test");
            expect(err.code).toBe("test_code");
        });
    });

    describe("DevupAPIError structure", () => {
        it("initializes DevupAPIError with correct structure", () => {
            const e = new DevupAPIError(404, "Msg", { type: "not_found", code: "machine_code" }, new Headers({ "X-Request-Id": "123" }));

            expect(e.name).toBe("DevupAPIError");
            expect(e.message).toBe("Msg");
            expect(e.status).toBe(404);
            expect(e.type).toBe("not_found");
            expect(e.code).toBe("machine_code");
            expect(e.requestId).toBe("123");
            expect(e.param).toBeNull();
            expect(e.warnings).toEqual([]);
            expect(e instanceof Error).toBe(true);
            expect(e instanceof DevupAPIError).toBe(true);
            // Object.keys exposes the fields
            expect(Object.keys(e)).toContain("type");
            expect(Object.keys(e)).toContain("code");
        });
    });

    describe("Exports and the ai integration", () => {
        it("exports root items correctly", () => {
            expect(rootExports.DevupAPIError).toBeDefined();
            expect(rootExports.default).toBeDefined();
            expect(rootExports.DevupAI).toBe(rootExports.default);
            expect(rootExports.APIPromise).toBeDefined();
            expect(rootExports.Stream).toBeDefined();
            expect(typeof rootExports.VERSION).toBe("string");
            for (const name of [
                "AuthenticationError",
                "PermissionDeniedError",
                "NotFoundError",
                "ConflictError",
                "RateLimitError",
                "InternalServerError",
                "APIConnectionError",
                "APITimeoutError",
                "verifyWebhookSignature",
                "constructWebhookEvent",
                "Webhooks",
                "DevupWebhookVerificationError",
            ]) {
                expect(rootExports, name).toHaveProperty(name);
            }
        });

        it("exports the ai integration correctly", () => {
            expect(aiExports.createDevupAI).toBeDefined();
            expect(aiExports.devupai).toBeDefined();
        });
    });
});
