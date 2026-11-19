// Retries on billed POSTs: only 429 and 503 (Retry-After honoured) and a connection that was
// never opened. A 408, 502 or 504 answer, or a connection lost after it was opened, can come
// after the request was processed and charged, so it is not retried. Every other request
// (the GETs) keeps the full retry set. `maxRetries` caps everything.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DevupAI, { APIConnectionError, DevupAPIError, type ClientOptions, type DebugEvent } from "../src/index";
import { BILLED_POST_RETRY, DEFAULT_RETRY } from "../src/core/client";
import { BASE, MODEL_A, TEST_KEY, errorResponse, jsonResponse, mockFetch, sequence, sseResponse, type Handler } from "./helpers/mock-fetch";

function setup(handler: Handler, options: Partial<ClientOptions> = {}) {
    const mock = mockFetch(handler);
    const events: DebugEvent[] = [];
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, onDebug: (e) => events.push(e), ...options });
    return { mock, client, retries: () => events.filter((e) => e.type === "retry").map((e) => e.detail) };
}

type Call = (client: DevupAI) => PromiseLike<unknown>;

const blob = (): Blob => new Blob(["x"]);
const ok = (): Response => jsonResponse({ ok: true });
const okStream = (): Response => sseResponse(["data: [DONE]\n\n"]);

/** Every billed method, in each of its request forms, with a success answer of the right kind. */
const BILLED: Array<[string, Call, () => Response]> = [
    ["chat.completions.create", (c) => c.chat.completions.create({ model: MODEL_A, messages: [{ role: "user", content: "Hi" }] }), ok],
    ["chat.completions.create (stream)", (c) => c.chat.completions.create({ model: MODEL_A, messages: [{ role: "user", content: "Hi" }], stream: true }), okStream],
    ["responses.create", (c) => c.responses.create({ model: MODEL_A, input: "Hi" }), ok],
    ["responses.create (stream)", (c) => c.responses.create({ model: MODEL_A, input: "Hi", stream: true }), okStream],
    ["embeddings.create", (c) => c.embeddings.create({ model: MODEL_A, input: "x" }), ok],
    ["rerank.create", (c) => c.rerank.create({ model: MODEL_A, query: "q", documents: ["a"] }), ok],
    ["images.generate", (c) => c.images.generate({ model: MODEL_A, prompt: "p" }), ok],
    ["images.edit (multipart)", (c) => c.images.edit({ model: MODEL_A, prompt: "p", image: blob() }), ok],
    ["images.edit (JSON)", (c) => c.images.edit({ model: MODEL_A, prompt: "p", images: ["https://example.com/a.png"] }), ok],
    ["audio.speech.create", (c) => c.audio.speech.create({ model: MODEL_A, input: "x", voice: "fixture-voice" }), ok],
    ["audio.transcriptions.create", (c) => c.audio.transcriptions.create({ model: MODEL_A, file: blob() }), ok],
    ["video.generations.create (JSON)", (c) => c.video.generations.create({ model: MODEL_A, prompt: "p" }), ok],
    ["video.generations.create (multipart)", (c) => c.video.generations.create({ model: MODEL_A, prompt: "p", image: blob() }), ok],
    ["video.edits.create", (c) => c.video.edits.create({ model: MODEL_A, video: blob() }), ok],
    ["inference.run", (c) => c.inference.run(MODEL_A, { input: "x" }), ok],
    ["inference.run (binary)", (c) => c.inference.run(MODEL_A, { input: "x" }, { responseType: "binary" }), ok],
];

/** Requests that are not billed POSTs: they keep the full retry set. */
const NOT_BILLED: Array<[string, Call, () => Response]> = [
    ["models.list", (c) => c.models.list(), () => jsonResponse({ object: "list", data: [] })],
    ["models.retrieve", (c) => c.models.retrieve(MODEL_A), ok],
    ["balance.retrieve", (c) => c.balance.retrieve(), () => jsonResponse({ balance_dzd: 1 })],
    ["me.retrieve", (c) => c.me.retrieve(), ok],
    ["health.check", (c) => c.health.check(), () => jsonResponse({ status: "ok" })],
    ["images.download", (c) => c.images.download(`${BASE}/images/proxy?d=a&s=b`), () => new Response("img", { status: 200 })],
];

/** A `fetch` rejection shaped like Node's: `TypeError("fetch failed")` with the system error as `cause`. */
function fetchFailed(code?: string): TypeError {
    const cause = code === undefined ? new Error("socket error") : Object.assign(new Error(`connect ${code}`), { code });
    return new TypeError("fetch failed", { cause });
}

/** The shape Node gives when several addresses were tried and each was refused. */
function fetchFailedAggregate(withCode: boolean): TypeError {
    const errors = [
        Object.assign(new Error("connect ECONNREFUSED ::1:443"), { code: "ECONNREFUSED" }),
        Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:443"), { code: "ECONNREFUSED" }),
    ];
    const aggregate = new AggregateError(errors, "");
    if (withCode) Object.assign(aggregate, { code: "ECONNREFUSED" });
    return new TypeError("fetch failed", { cause: aggregate });
}

beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0); // full jitter: no wait between attempts
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe("the retry policies", () => {
    it("billed POSTs retry 429 and 503 only, and only a connection that was never opened", () => {
        expect([...BILLED_POST_RETRY.statuses].sort()).toEqual([429, 503]);
        expect(BILLED_POST_RETRY.connectionErrors).toBe("not_sent");
    });

    it("other requests keep 408, 429, 502, 503, 504 and every connection error", () => {
        expect([...DEFAULT_RETRY.statuses].sort()).toEqual([408, 429, 502, 503, 504]);
        expect(DEFAULT_RETRY.connectionErrors).toBe("all");
    });
});

describe.each(BILLED)("billed: %s", (_name, call, success) => {
    it.each([408, 502, 504])("status %i: one attempt, the error is thrown, no retry event", async (status) => {
        const { client, mock, retries } = setup(() => errorResponse(status, "fixture_status"));
        const err = await Promise.resolve(call(client)).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(DevupAPIError);
        expect((err as DevupAPIError).status).toBe(status);
        expect(mock.calls).toHaveLength(1);
        expect(retries()).toEqual([]);
    });

    it.each([429, 503])("status %i: retried after the wait the API asks for, with a retry event", async (status) => {
        const { client, mock, retries } = setup(sequence(errorResponse(status, "fixture_capacity", "busy", { "retry-after-ms": "5" }), success()));
        await Promise.resolve(call(client));
        expect(mock.calls).toHaveLength(2);
        expect(retries()).toEqual([{ attempt: 1, status, waitMs: 5 }]);
        expect(mock.calls[1]!.url).toBe(mock.calls[0]!.url);
        expect(mock.calls[1]!.method).toBe("POST");
    });

    it("status 503 every time: up to maxRetries (2 by default), then the error", async () => {
        const { client, mock, retries } = setup(() => errorResponse(503, "fixture_capacity", "busy", { "retry-after-ms": "1" }));
        const err = await Promise.resolve(call(client)).catch((e: unknown) => e);
        expect((err as DevupAPIError).status).toBe(503);
        expect(mock.calls).toHaveLength(3);
        expect(retries().map((d) => d.status)).toEqual([503, 503]);
    });

    it("a connection that was never opened (ECONNREFUSED) is retried, with a status 0 retry event", async () => {
        const { client, mock, retries } = setup(sequence(fetchFailed("ECONNREFUSED"), success()));
        await Promise.resolve(call(client));
        expect(mock.calls).toHaveLength(2);
        expect(retries()).toEqual([{ attempt: 1, status: 0, waitMs: 0 }]);
    });

    it.each([
        ["ECONNRESET", fetchFailed("ECONNRESET")],
        ["UND_ERR_SOCKET", fetchFailed("UND_ERR_SOCKET")],
        ["a cause without a code", fetchFailed()],
        ["a TypeError without a cause", new TypeError("fetch failed")],
    ])("another connection error (%s): one attempt, APIConnectionError with the cause", async (_label, error) => {
        const { client, mock, retries } = setup(sequence(error, success()));
        const err = await Promise.resolve(call(client)).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(APIConnectionError);
        expect((err as APIConnectionError).status).toBe(0);
        expect((err as APIConnectionError).cause).toBe(error);
        expect(mock.calls).toHaveLength(1);
        expect(retries()).toEqual([]);
    });

    it("maxRetries: 0 sends one request on a 429", async () => {
        const { client, mock } = setup(() => errorResponse(429, "fixture_capacity", "busy", { "retry-after-ms": "1" }), { maxRetries: 0 });
        await expect(Promise.resolve(call(client))).rejects.toBeInstanceOf(DevupAPIError);
        expect(mock.calls).toHaveLength(1);
    });
});

describe("billed: the connection errors that show nothing was sent", () => {
    it.each([
        ["ECONNREFUSED", fetchFailed("ECONNREFUSED")],
        ["ENOTFOUND", fetchFailed("ENOTFOUND")],
        ["EAI_AGAIN", fetchFailed("EAI_AGAIN")],
        ["UND_ERR_CONNECT_TIMEOUT", fetchFailed("UND_ERR_CONNECT_TIMEOUT")],
        ["an AggregateError with a code", fetchFailedAggregate(true)],
        ["an AggregateError whose errors are all refused", fetchFailedAggregate(false)],
        ["the code on the error itself", Object.assign(new Error("request to the API failed"), { code: "ENOTFOUND" })],
    ])("%s is retried up to maxRetries", async (_label, error) => {
        const { client, mock, retries } = setup(sequence(error));
        const err = await client.images.generate({ model: MODEL_A, prompt: "p" }).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(APIConnectionError);
        expect((err as APIConnectionError).cause).toBe(error);
        expect(mock.calls).toHaveLength(3);
        expect(retries().map((d) => d.status)).toEqual([0, 0]);
    });

    it("an AggregateError with one error that is not a refusal is not retried", async () => {
        const errors = [
            Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
            Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
        ];
        const error = new TypeError("fetch failed", { cause: new AggregateError(errors, "") });
        const { client, mock } = setup(sequence(error));
        await expect(client.images.generate({ model: MODEL_A, prompt: "p" })).rejects.toBeInstanceOf(APIConnectionError);
        expect(mock.calls).toHaveLength(1);
    });
});

describe("billed: Retry-After", () => {
    it("Retry-After in seconds is waited for before the second attempt", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
        const { client, mock, retries } = setup(sequence(errorResponse(429, "fixture_capacity", "busy", { "retry-after": "2" }), ok()));
        const promise = client.images.generate({ model: MODEL_A, prompt: "p" });
        await vi.advanceTimersByTimeAsync(1999);
        expect(mock.calls).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);
        await expect(promise).resolves.toEqual({ ok: true });
        expect(mock.calls).toHaveLength(2);
        expect(retries()).toEqual([{ attempt: 1, status: 429, waitMs: 2000 }]);
    });

    it("a wait longer than the remaining timeout throws at once", async () => {
        const { client, mock } = setup(() => errorResponse(503, "fixture_capacity", "busy", { "retry-after": "120" }), { timeout: 5_000 });
        const err = await client.embeddings.create({ model: MODEL_A, input: "x" }).catch((e: unknown) => e);
        expect((err as DevupAPIError).retryAfterMs).toBe(120_000);
        expect(mock.calls).toHaveLength(1);
    });
});

describe.each(NOT_BILLED)("not billed: %s keeps today's retries", (_name, call, success) => {
    it.each([408, 429, 502, 503, 504])("status %i is retried", async (status) => {
        const { client, mock, retries } = setup(sequence(errorResponse(status, "fixture_status"), success()));
        await Promise.resolve(call(client));
        expect(mock.calls).toHaveLength(2);
        expect(retries().map((d) => d.status)).toEqual([status]);
    });

    it.each([
        ["ECONNRESET", fetchFailed("ECONNRESET")],
        ["a generic fetch failure", new TypeError("fetch failed")],
    ])("a connection error (%s) is retried", async (_label, error) => {
        const { client, mock, retries } = setup(sequence(error, success()));
        await Promise.resolve(call(client));
        expect(mock.calls).toHaveLength(2);
        expect(retries()).toEqual([{ attempt: 1, status: 0, waitMs: 0 }]);
    });
});
