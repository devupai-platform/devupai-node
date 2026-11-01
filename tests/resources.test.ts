// D11: every method's URL, method, auth and body; the new and fixed methods (block0 §3.9 items 5, 12).
import { describe, expect, it } from "vitest";
import DevupAI, {
    DevupAPIError,
    NotFoundError,
    Stream,
    type EmbeddingCreateResponse,
    type ResponseObject,
    type ResponseStreamEvent,
    type TranscriptionVerboseResponse,
} from "../src/index";
import {
    BASE,
    DONE,
    MODEL_A,
    MODEL_B,
    REQ_ID,
    TEST_KEY,
    errorResponse,
    jsonResponse,
    mockFetch,
    sseResponse,
    type Handler,
    type RecordedRequest,
} from "./helpers/mock-fetch";

function setup(handler: Handler, baseURL?: string) {
    const mock = mockFetch(handler);
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0, ...(baseURL ? { baseURL } : {}) });
    return { mock, client };
}

function expectAuth(req: RecordedRequest, auth: boolean): void {
    if (auth) expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
    else expect(req.headers.has("authorization")).toBe(false);
}

const RESPONSE: ResponseObject = {
    id: "resp_fixture",
    object: "response",
    created_at: 1700000000,
    model: MODEL_A,
    status: "completed",
    output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "Hi" }] }],
    usage: { input_tokens: 5, output_tokens: 1, total_tokens: 6 },
    _devup: { cost_dzd: 1, balance_dzd: 99, request_id: REQ_ID },
};

function sseEvent(event: string | null, data: unknown): string {
    return `${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(data)}\n\n`;
}

describe("models (D11, defect 1)", () => {
    it("models.list(): GET /models with the Bearer key", async () => {
        const { client, mock } = setup(() => jsonResponse({ object: "list", data: [] }));
        const list = await client.models.list();
        const req = mock.last();
        expect(req.method).toBe("GET");
        expect(req.url).toBe(`${BASE}/models`);
        expectAuth(req, true);
        expect(req.body).toBeNull();
        expect(list).toEqual({ object: "list", data: [] });
    });

    it("models.retrieve(id): GET /models/<id> with / encoded as %2F, Bearer key", async () => {
        const model = { id: MODEL_A, object: "model", owned_by: "fixture" };
        const { client, mock } = setup(() => jsonResponse(model));
        const result = await client.models.retrieve(MODEL_A);
        const req = mock.last();
        expect(req.method).toBe("GET");
        expect(req.url).toBe(`${BASE}/models/fixture%2Fmodel-a`);
        expectAuth(req, true);
        expect(result).toEqual(model);
    });

    it("models.retrieve encodes reserved characters", async () => {
        const { client, mock } = setup(() => jsonResponse({}));
        await client.models.retrieve("fixture/model a?b#c");
        expect(mock.last().url).toBe(`${BASE}/models/fixture%2Fmodel%20a%3Fb%23c`);
    });

    it("models.retrieve of an unknown id throws NotFoundError", async () => {
        const { client } = setup(() => errorResponse(404, "model_not_found"));
        const err = await client.models.retrieve(MODEL_B).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(NotFoundError);
        expect((err as NotFoundError).code).toBe("model_not_found");
    });
});

describe("responses.create (D11, §3.9 item 12)", () => {
    it("JSON: POST /responses with the body, returns the response object", async () => {
        const { client, mock } = setup(() => jsonResponse(RESPONSE));
        const result = await client.responses.create({ model: MODEL_A, input: "Hi", max_output_tokens: 16 });
        const req = mock.last();
        expect(req.method).toBe("POST");
        expect(req.url).toBe(`${BASE}/responses`);
        expectAuth(req, true);
        expect(req.headers.get("content-type")).toBe("application/json");
        expect(req.json).toEqual({ model: MODEL_A, input: "Hi", max_output_tokens: 16 });
        expect(result).toStrictEqual(RESPONSE);
        expect(result._devup?.request_id).toBe(REQ_ID);
    });

    it("stream: parses typed events (with and without SSE event names) and exposes the request id", async () => {
        const events = [
            { type: "response.created", sequence_number: 0, response: { ...RESPONSE, status: "in_progress", output: [] } },
            { type: "response.output_text.delta", sequence_number: 1, item_id: "msg_1", output_index: 0, content_index: 0, delta: "Hi" },
            { type: "response.output_text.done", sequence_number: 2, item_id: "msg_1", output_index: 0, content_index: 0, text: "Hi" },
            { type: "response.fixture_future_event", sequence_number: 3 },
            { type: "response.completed", sequence_number: 4, response: RESPONSE },
        ];
        const { client, mock } = setup(() =>
            sseResponse([sseEvent(events[0]!.type, events[0]), sseEvent(null, events[1]), sseEvent(events[2]!.type, events[2]), sseEvent(null, events[3]), sseEvent(events[4]!.type, events[4])]),
        );
        const stream = await client.responses.create({ model: MODEL_A, input: "Hi", stream: true });
        expect(stream).toBeInstanceOf(Stream);
        expect(stream.requestId).toBe(REQ_ID);
        expect(mock.last().json).toEqual({ model: MODEL_A, input: "Hi", stream: true });

        const seen: ResponseStreamEvent[] = [];
        let text = "";
        for await (const event of stream) {
            seen.push(event);
            if (event.type === "response.output_text.delta") text += event.delta ?? "";
        }
        expect(seen).toEqual(events);
        expect(text).toBe("Hi");
        const done = seen[seen.length - 1]!;
        expect(done.type).toBe("response.completed");
    });

    it("stream: an error event throws DevupAPIError with the event code and the request id", async () => {
        const errorEvent = {
            type: "error",
            sequence_number: 2,
            code: "fixture_capacity",
            message: "The request could not be completed.",
            param: null,
            error: { message: "The request could not be completed.", type: "devup_error", code: "fixture_capacity" },
        };
        const { client } = setup(() =>
            sseResponse([
                sseEvent("response.created", { type: "response.created", sequence_number: 0, response: RESPONSE }),
                sseEvent("error", errorEvent),
                DONE,
            ]),
        );
        const stream = await client.responses.create({ model: MODEL_A, input: "Hi", stream: true });
        const seen: ResponseStreamEvent[] = [];
        const err = await (async () => {
            for await (const e of stream) seen.push(e);
        })().catch((e: unknown) => e);
        expect(seen).toHaveLength(1);
        expect(err).toBeInstanceOf(DevupAPIError);
        expect((err as DevupAPIError).code).toBe("fixture_capacity");
        expect((err as DevupAPIError).message).toBe("The request could not be completed.");
        expect((err as DevupAPIError).requestId).toBe(REQ_ID);
    });

    it("stream: an SSE event named error without a type field also throws", async () => {
        const { client } = setup(() => sseResponse([sseEvent("error", { error: { message: "Fixture.", type: "devup_error", code: "fixture_invalid" } })]));
        const stream = await client.responses.create({ model: MODEL_A, input: "Hi", stream: true });
        const err = await (async () => {
            for await (const _e of stream) {
                /* drain */
            }
        })().catch((e: unknown) => e);
        expect(err).toBeInstanceOf(DevupAPIError);
        expect((err as DevupAPIError).code).toBe("fixture_invalid");
    });
});

describe("images.download (D11, D18, §3.9 item 5)", () => {
    const signed = `${BASE}/images/proxy?d=fixture-token&s=fixture-signature`;
    const REJECTED_MESSAGE = "images.download only fetches URLs returned by the API.";

    it("replaces the 3.x method, with no alias (D18)", () => {
        const { client } = setup(() => new Response("x"));
        expect(typeof client.images.download).toBe("function");
        // `in` also looks through the prototype chain.
        expect("proxy" in client.images).toBe(false);
    });

    it("fetches the signed URL as given, with GET, no key, and returns the raw Response with its body unread", async () => {
        const bytes = new Uint8Array([137, 80, 78, 71]);
        const { client, mock } = setup(() => new Response(bytes, { status: 200, headers: { "content-type": "image/png", "x-request-id": REQ_ID } }));
        const response = await client.images.download(signed);
        const req = mock.last();
        expect(req.method).toBe("GET");
        expect(req.url).toBe(signed);
        expect(new URL(req.url).searchParams.get("d")).toBe("fixture-token");
        expect(new URL(req.url).searchParams.get("s")).toBe("fixture-signature");
        expectAuth(req, false);
        expect(response).toBeInstanceOf(Response);
        expect(response.bodyUsed).toBe(false);
        expect(response.headers.get("content-type")).toBe("image/png");
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    });

    it("passes a Range header through", async () => {
        const { client, mock } = setup(() => new Response("ab", { status: 206 }));
        const response = await client.images.download(signed, { headers: { Range: "bytes=0-1" } });
        expect(response.status).toBe(206);
        expect(mock.last().headers.get("range")).toBe("bytes=0-1");
    });

    it.each([
        "https://files.example.com/v1/images/proxy?d=a&s=b",
        "http://api.devupai.com/v1/images/proxy?d=a&s=b",
        "https://api.devupai.com:8443/v1/images/proxy?d=a&s=b",
        "https://api.devupai.com.example.com/v1/images/proxy?d=a&s=b",
        "/v1/images/proxy?d=a&s=b",
        "not a url",
        "",
    ])("rejects %j before any fetch (code invalid_url)", async (url) => {
        const { client, mock } = setup(() => new Response("x"));
        const err = await client.images.download(url).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(DevupAPIError);
        const e = err as DevupAPIError;
        expect(e.status).toBe(0);
        expect(e.code).toBe("invalid_url");
        expect(e.message).toBe(REJECTED_MESSAGE);
        expect(mock.calls).toHaveLength(0);
    });

    // m6: a URL on the right origin that carries credentials is rejected too, and the
    // error never repeats the URL (so the credentials cannot leak into logs).
    it.each([
        ["username and password", "https://fixture-user:fixture-secret@api.devupai.com/v1/images/proxy?d=a&s=b", ["fixture-user", "fixture-secret"]],
        ["username only", "https://fixture-user@api.devupai.com/v1/images/proxy?d=a&s=b", ["fixture-user"]],
        ["password only", "https://:fixture-secret@api.devupai.com/v1/images/proxy?d=a&s=b", ["fixture-secret"]],
    ])("rejects a URL with %s before any fetch, without echoing the credentials (m6)", async (_label, url, secrets) => {
        const { client, mock } = setup(() => new Response("x"));
        const err = await client.images.download(url).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(DevupAPIError);
        const e = err as DevupAPIError;
        expect(e.status).toBe(0);
        expect(e.code).toBe("invalid_url");
        expect(e.message).toBe(REJECTED_MESSAGE);
        const visible = `${e.message}\n${String(e.stack)}\n${JSON.stringify(e)}`;
        for (const secret of secrets) expect(visible).not.toContain(secret);
        expect(visible).not.toContain(url);
        expect(mock.calls).toHaveLength(0);
    });

    it("compares with the origin of a custom baseURL", async () => {
        const { client, mock } = setup(() => new Response("x"), "http://localhost:3000/api/v1");
        await client.images.download("http://localhost:3000/api/v1/images/proxy?d=a&s=b");
        expect(mock.last().url).toBe("http://localhost:3000/api/v1/images/proxy?d=a&s=b");
        await expect(client.images.download("http://localhost:4000/api/v1/images/proxy?d=a&s=b")).rejects.toBeInstanceOf(DevupAPIError);
        await expect(client.images.download("http://fixture-user:fixture-secret@localhost:3000/api/v1/images/proxy?d=a&s=b")).rejects.toBeInstanceOf(DevupAPIError);
        expect(mock.calls).toHaveLength(1);
    });
});

describe("fixed shapes (D11)", () => {
    it("rerank without return_documents sends no return_documents key", async () => {
        const { client, mock } = setup(() => jsonResponse({ object: "list", model: MODEL_B, results: [{ index: 0, relevance_score: 0.5 }], _devup: { cost_dzd: 1, balance_dzd: 2 } }));
        const result = await client.rerank.create({ model: MODEL_B, query: "q", documents: ["a", "b"] });
        const req = mock.last();
        expect(req.url).toBe(`${BASE}/rerank`);
        expect(req.method).toBe("POST");
        expectAuth(req, true);
        expect(req.json).toEqual({ model: MODEL_B, query: "q", documents: ["a", "b"] });
        expect(result.results[0]!.document).toBeUndefined();
    });

    it("transcription verbose_json returns the verbose fields and _devup", async () => {
        const verbose: TranscriptionVerboseResponse = {
            task: "transcribe",
            language: "english",
            duration: 1.5,
            text: "Hello world",
            segments: [{ id: 0, start: 0, end: 1, text: "Hello world" }],
            words: [
                { word: "Hello", start: 0, end: 0.5 },
                { word: "world", start: 0.5, end: 1 },
            ],
            _devup: { cost_dzd: 1, balance_dzd: 2, request_id: REQ_ID },
        };
        const { client, mock } = setup(() => jsonResponse(verbose));
        const result = await client.audio.transcriptions.create({ file: new Uint8Array([1, 2, 3]), model: MODEL_A, response_format: "verbose_json", language: "en" });
        const req = mock.last();
        expect(req.url).toBe(`${BASE}/audio/transcriptions`);
        expect(req.form?.get("response_format")).toBe("verbose_json");
        expect(req.form?.get("language")).toBe("en");
        expect(req.form?.get("file")).toBeInstanceOf(Blob);
        expect(result.words?.[1]?.word).toBe("world");
        expect(result.task).toBe("transcribe");
        expect(result._devup.request_id).toBe(REQ_ID);
    });

    it("embeddings keep a base64 string embedding as is", async () => {
        const body: EmbeddingCreateResponse = {
            object: "list",
            model: MODEL_B,
            data: [{ object: "embedding", index: 0, embedding: "AAAAPwAAgD8=" }],
            usage: { prompt_tokens: 1, total_tokens: 1 },
        };
        const { client, mock } = setup(() => jsonResponse(body));
        const result = await client.embeddings.create({ model: MODEL_B, input: ["a"], encoding_format: "base64" });
        expect(mock.last().json).toEqual({ model: MODEL_B, input: ["a"], encoding_format: "base64" });
        const embedding: number[] | string | undefined = result.data[0]!.embedding;
        expect(embedding).toBe("AAAAPwAAgD8=");
    });
});

describe("other methods: URL, method and auth (D11)", () => {
    it("video.generations.create: POST /video/generations JSON", async () => {
        const { client, mock } = setup(() => jsonResponse({ data: [{ url: "https://example.com/v.mp4" }], _devup: { cost_dzd: 1, balance_dzd: 2 } }));
        await client.video.generations.create({ model: MODEL_A, prompt: "a boat", response_format: "url" });
        const req = mock.last();
        expect(req.method).toBe("POST");
        expect(req.url).toBe(`${BASE}/video/generations`);
        expectAuth(req, true);
        expect(req.headers.get("content-type")).toBe("application/json");
        expect(req.json).toEqual({ model: MODEL_A, prompt: "a boat", response_format: "url" });
    });

    it("inference.run: POST /inference/<encoded path> with the payload", async () => {
        const { client, mock } = setup(() => jsonResponse({ ok: true }));
        const result = await client.inference.run(MODEL_B, { inputs: "hello" });
        const req = mock.last();
        expect(req.method).toBe("POST");
        expect(req.url).toBe(`${BASE}/inference/fixture%2Fmodel-b`);
        expectAuth(req, true);
        expect(req.json).toEqual({ inputs: "hello" });
        expect(result).toEqual({ ok: true });
    });

    it("health.check: GET /health without a key", async () => {
        const { client, mock } = setup(() => jsonResponse({ status: "ok" }));
        const result = await client.health.check();
        const req = mock.last();
        expect(req.method).toBe("GET");
        expect(req.url).toBe("https://api.devupai.com/health");
        expectAuth(req, false);
        expect(result.status).toBe("ok");
    });

    it("request options mixed into params (3.x style) are stripped from the body; the second argument wins", async () => {
        const { client, mock } = setup(() => jsonResponse({ id: "x" }));
        await client.chat.completions.create(
            { model: MODEL_A, messages: [], headers: { "X-A": "1", "X-B": "1" }, timeout: 5_000, maxRetries: 0 },
            { headers: { "X-A": "2" } },
        );
        const req = mock.last();
        expect(req.json).toEqual({ model: MODEL_A, messages: [] });
        expect(req.headers.get("x-a")).toBe("2");
        expect(req.headers.get("x-b")).toBe("1");
    });
});
