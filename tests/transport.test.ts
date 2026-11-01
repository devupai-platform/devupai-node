// Transport: D6 (APIPromise / withResponse), D7 (retries), D8 (timeouts, signals), D9 (errors), D10 (User-Agent).
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DevupAI, {
    APIConnectionError,
    APIPromise,
    APITimeoutError,
    AuthenticationError,
    ConflictError,
    DevupAPIError,
    InternalServerError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
    VERSION,
    type ClientOptions,
    type DebugEvent,
} from "../src/index";
import { makeAPIError, parseRetryAfterMs, parseWarnings } from "../src/core/errors";
import {
    BASE,
    MODEL_A,
    REQ_ID,
    REQ_ID_2,
    TEST_KEY,
    errorResponse,
    hangUntilAborted,
    jsonResponse,
    mockFetch,
    sequence,
    sseResponse,
    type Handler,
} from "./helpers/mock-fetch";

const PKG_VERSION: string = (JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8")) as { version: string }).version;

const COMPLETION = {
    id: "chatcmpl-00000000-0000-4000-8000-000000000000",
    object: "chat.completion",
    created: 1700000000,
    model: MODEL_A,
    choices: [{ index: 0, message: { role: "assistant", content: "Hi" }, finish_reason: "stop" }],
};
const CHAT = { model: MODEL_A, messages: [{ role: "user" as const, content: "Hi" }] };

function setup(handler: Handler, options: Partial<ClientOptions> = {}) {
    const mock = mockFetch(handler);
    const events: DebugEvent[] = [];
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, onDebug: (e) => events.push(e), ...options });
    return { mock, client, events, retries: () => events.filter((e) => e.type === "retry").map((e) => e.detail) };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe("APIPromise and withResponse() (D6, block0 §3.9 items 9, 10)", () => {
    it("every resource method returns an APIPromise (a real Promise subclass with withResponse)", async () => {
        const { client, mock } = setup((req) => {
            const accept = req.headers.get("accept");
            if (accept === "text/event-stream") return sseResponse(["data: [DONE]\n\n"]);
            if (accept === "*/*") return new Response("x", { status: 200 });
            return jsonResponse({ text: "x" });
        }, { maxRetries: 0 });
        const blob = new Blob(["x"]);
        const calls: Array<[string, () => unknown]> = [
            ["chat.completions.create", () => client.chat.completions.create(CHAT)],
            ["chat.completions.create (stream)", () => client.chat.completions.create({ ...CHAT, stream: true })],
            ["responses.create", () => client.responses.create({ model: MODEL_A, input: "Hi" })],
            ["responses.create (stream)", () => client.responses.create({ model: MODEL_A, input: "Hi", stream: true })],
            ["models.list", () => client.models.list()],
            ["models.retrieve", () => client.models.retrieve(MODEL_A)],
            ["images.generate", () => client.images.generate({ model: MODEL_A, prompt: "p" })],
            ["images.edit", () => client.images.edit({ model: MODEL_A, image: blob, prompt: "p" })],
            ["images.download", () => client.images.download(`${BASE}/images/proxy?d=a&s=b`)],
            ["images.download (rejected URL)", () => client.images.download("https://files.example.com/a.png")],
            ["embeddings.create", () => client.embeddings.create({ model: MODEL_A, input: "x" })],
            ["rerank.create", () => client.rerank.create({ model: MODEL_A, query: "q", documents: ["a"] })],
            ["audio.speech.create", () => client.audio.speech.create({ model: MODEL_A, input: "x", voice: "fixture-voice" })],
            ["audio.transcriptions.create", () => client.audio.transcriptions.create({ model: MODEL_A, file: blob })],
            ["audio.transcriptions.create (text)", () => client.audio.transcriptions.create({ model: MODEL_A, file: blob, response_format: "text" })],
            ["video.generations.create", () => client.video.generations.create({ model: MODEL_A, prompt: "p" })],
            ["video.edits.create", () => client.video.edits.create({ model: MODEL_A, video: blob })],
            ["inference.run", () => client.inference.run(MODEL_A, { input: "x" })],
            ["balance.retrieve", () => client.balance.retrieve()],
            ["health.check", () => client.health.check()],
        ];
        for (const [name, call] of calls) {
            const promise = call();
            expect(promise, name).toBeInstanceOf(APIPromise);
            expect(promise, name).toBeInstanceOf(Promise);
            expect(typeof (promise as APIPromise<unknown>).withResponse, name).toBe("function");
            await (promise as APIPromise<unknown>).catch(() => undefined);
        }
        // Every call except the rejected URL reached fetch.
        expect(mock.calls).toHaveLength(calls.length - 1);
    });

    it("chat.completions.create resolves to the parsed body, with no hidden properties, and chains like a Promise", async () => {
        const { client } = setup(() => jsonResponse(COMPLETION));
        const promise = client.chat.completions.create(CHAT);
        expect(promise).toBeInstanceOf(APIPromise);
        expect(promise).toBeInstanceOf(Promise);
        expect(typeof promise.withResponse).toBe("function");
        const data = await promise;
        expect(data).toStrictEqual(COMPLETION);
        // No hidden (non-enumerable) properties on the data.
        expect(Object.getOwnPropertyNames(data).sort()).toEqual(Object.keys(data).sort());
        expect(Object.getOwnPropertySymbols(data)).toEqual([]);
        // then / catch / finally chain like a Promise.
        const id = await client.chat.completions.create(CHAT).then((c) => c.id).finally(() => undefined);
        expect(id).toBe(COMPLETION.id);
    });

    it("withResponse() resolves data, response, requestId and parsed X-DEVUP-Warnings", async () => {
        const { client, mock } = setup(() =>
            jsonResponse(COMPLETION, { headers: { "x-request-id": REQ_ID_2, "X-DEVUP-Warnings": "fixture_notice_a, fixture_notice_b,, " } }),
        );
        const { data, response, requestId, warnings } = await client.chat.completions.create(CHAT).withResponse();
        expect(data).toStrictEqual(COMPLETION);
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.headers.get("x-request-id")).toBe(REQ_ID_2);
        expect(requestId).toBe(REQ_ID_2);
        expect(warnings).toEqual(["fixture_notice_a", "fixture_notice_b"]);
        expect(mock.calls).toHaveLength(1);
    });

    it("withResponse() without the headers gives null and []", async () => {
        const { client } = setup(() => new Response(JSON.stringify({ balance_dzd: 1 }), { headers: { "content-type": "application/json" } }));
        const { data, requestId, warnings } = await client.balance.retrieve().withResponse();
        expect(data).toEqual({ balance_dzd: 1 });
        expect(requestId).toBeNull();
        expect(warnings).toEqual([]);
    });

    it("withResponse() rejects with the API error", async () => {
        const { client } = setup(() => errorResponse(404, "model_not_found"), { maxRetries: 0 });
        await expect(client.models.retrieve(MODEL_A).withResponse()).rejects.toBeInstanceOf(NotFoundError);
    });
});

describe("retries (D7, block0 §3.9 item 8)", () => {
    beforeEach(() => {
        vi.spyOn(Math, "random").mockReturnValue(0); // full jitter → no wait
    });

    it("429 with retry-after-ms waits that long, then retries the same request", async () => {
        const { client, mock, retries } = setup(sequence(errorResponse(429, "fixture_capacity", "busy", { "retry-after-ms": "25" }), jsonResponse(COMPLETION)));
        const started = Date.now();
        await expect(client.chat.completions.create(CHAT)).resolves.toStrictEqual(COMPLETION);
        expect(Date.now() - started).toBeGreaterThanOrEqual(20);
        expect(mock.calls).toHaveLength(2);
        expect(retries()).toEqual([{ attempt: 1, status: 429, waitMs: 25 }]);
        const [a, b] = mock.calls;
        expect(b!.method).toBe(a!.method);
        expect(b!.url).toBe(a!.url);
        expect(b!.text).toBe(a!.text);
        expect(b!.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
    });

    it.each([408, 429, 502, 503, 504])("retries status %i (up to maxRetries = 2 by default)", async (status) => {
        const { client, mock, retries } = setup(() => errorResponse(status, "fixture_capacity"));
        const err = await client.chat.completions.create(CHAT).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(DevupAPIError);
        expect((err as DevupAPIError).status).toBe(status);
        expect(mock.calls).toHaveLength(3);
        expect(retries().map((d) => d.status)).toEqual([status, status]);
    });

    it.each([
        [400, DevupAPIError],
        [401, AuthenticationError],
        [402, DevupAPIError],
        [403, PermissionDeniedError],
        [404, NotFoundError],
        [409, ConflictError],
        [422, DevupAPIError],
        [500, InternalServerError],
        [501, InternalServerError],
    ] as const)("never retries status %i", async (status, cls) => {
        const { client, mock, retries } = setup(() => errorResponse(status, "fixture_conflict"));
        const err = await client.chat.completions.create(CHAT).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(cls);
        expect(mock.calls).toHaveLength(1);
        expect(retries()).toEqual([]);
    });

    it("retries a connection error before any response", async () => {
        const { client, mock, retries } = setup(sequence(new TypeError("fetch failed"), jsonResponse(COMPLETION)));
        await expect(client.chat.completions.create(CHAT)).resolves.toStrictEqual(COMPLETION);
        expect(mock.calls).toHaveLength(2);
        expect(retries()).toEqual([{ attempt: 1, status: 0, waitMs: 0 }]);
    });

    it("throws APIConnectionError with the cause once the retries are used up", async () => {
        const cause = new TypeError("fetch failed");
        const { client, mock } = setup(sequence(cause));
        const err = await client.balance.retrieve().catch((e: unknown) => e);
        expect(err).toBeInstanceOf(APIConnectionError);
        expect(err).not.toBeInstanceOf(APITimeoutError);
        expect((err as APIConnectionError).status).toBe(0);
        expect((err as APIConnectionError).cause).toBe(cause);
        expect(mock.calls).toHaveLength(3);
    });

    it("maxRetries: 0 on the client sends one request", async () => {
        const { client, mock } = setup(() => errorResponse(503, "fixture_capacity"), { maxRetries: 0 });
        await expect(client.chat.completions.create(CHAT)).rejects.toBeInstanceOf(InternalServerError);
        expect(mock.calls).toHaveLength(1);
    });

    it("maxRetries can be overridden per call (both directions)", async () => {
        const a = setup(() => errorResponse(503, "fixture_capacity"), { maxRetries: 0 });
        await expect(a.client.chat.completions.create(CHAT, { maxRetries: 1 })).rejects.toBeInstanceOf(DevupAPIError);
        expect(a.mock.calls).toHaveLength(2);

        const b = setup(() => errorResponse(503, "fixture_capacity"), { maxRetries: 2 });
        await expect(b.client.chat.completions.create(CHAT, { maxRetries: 0 })).rejects.toBeInstanceOf(DevupAPIError);
        expect(b.mock.calls).toHaveLength(1);
    });

    it("a stream is retried only before it is returned (status error), never after the first byte", async () => {
        const { client, mock } = setup(
            sequence(errorResponse(503, "fixture_capacity"), sseResponse(["data: {\"id\":\"x\",\"choices\":[]}\n\n"], { errorAfter: new Error("reset") })),
        );
        const stream = await client.chat.completions.create({ ...CHAT, stream: true });
        expect(mock.calls).toHaveLength(2);
        await expect(
            (async () => {
                for await (const _c of stream) {
                    /* drain */
                }
            })(),
        ).rejects.toBeInstanceOf(APIConnectionError);
        expect(mock.calls).toHaveLength(2);
    });

    it("Retry-After in seconds is honoured", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
        const { client, mock, retries } = setup(sequence(errorResponse(503, "fixture_capacity", "busy", { "retry-after": "2" }), jsonResponse(COMPLETION)));
        const promise = client.chat.completions.create(CHAT);
        await vi.advanceTimersByTimeAsync(1999);
        expect(mock.calls).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);
        await expect(promise).resolves.toStrictEqual(COMPLETION);
        expect(mock.calls).toHaveLength(2);
        expect(retries()).toEqual([{ attempt: 1, status: 503, waitMs: 2000 }]);
    });

    it("Retry-After as an HTTP date is honoured", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
        vi.setSystemTime(new Date("2026-11-01T10:00:00.000Z"));
        const at = new Date("2026-11-01T10:00:03.000Z").toUTCString();
        const { client, mock, retries } = setup(sequence(errorResponse(429, "fixture_capacity", "busy", { "retry-after": at }), jsonResponse(COMPLETION)));
        const promise = client.chat.completions.create(CHAT);
        await vi.advanceTimersByTimeAsync(3000);
        await expect(promise).resolves.toStrictEqual(COMPLETION);
        expect(mock.calls).toHaveLength(2);
        expect(retries()).toEqual([{ attempt: 1, status: 429, waitMs: 3000 }]);
    });

    it("retry-after-ms wins over Retry-After", async () => {
        const { client, retries } = setup(
            sequence(errorResponse(503, "fixture_capacity", "busy", { "retry-after-ms": "5", "retry-after": "30" }), jsonResponse(COMPLETION)),
        );
        await client.chat.completions.create(CHAT);
        expect(retries()).toEqual([{ attempt: 1, status: 503, waitMs: 5 }]);
    });

    it("a server wait above 60 s is honoured when it fits in the remaining timeout", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
        const { client, mock, retries } = setup(sequence(errorResponse(429, "fixture_capacity", "busy", { "retry-after": "120" }), jsonResponse(COMPLETION)));
        const promise = client.chat.completions.create(CHAT);
        await vi.advanceTimersByTimeAsync(119_000);
        expect(mock.calls).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1_000);
        await expect(promise).resolves.toStrictEqual(COMPLETION);
        expect(retries()).toEqual([{ attempt: 1, status: 429, waitMs: 120_000 }]);
    });

    it("a server wait longer than the remaining timeout throws at once with retryAfterMs set", async () => {
        const { client, mock, retries } = setup(() => errorResponse(429, "fixture_capacity", "busy", { "retry-after": "120" }), { timeout: 5_000 });
        const started = Date.now();
        const err = await client.chat.completions.create(CHAT).catch((e: unknown) => e);
        expect(Date.now() - started).toBeLessThan(1_000);
        expect(err).toBeInstanceOf(RateLimitError);
        expect((err as RateLimitError).retryAfterMs).toBe(120_000);
        expect(mock.calls).toHaveLength(1);
        expect(retries()).toEqual([]);

        const b = setup(() => errorResponse(503, "fixture_capacity", "busy", { "retry-after-ms": "5000" }), { timeout: 1_000 });
        const err2 = await b.client.chat.completions.create(CHAT).catch((e: unknown) => e);
        expect((err2 as DevupAPIError).retryAfterMs).toBe(5_000);
        expect(b.mock.calls).toHaveLength(1);
    });

    it("backoff without a server wait uses full jitter, grows exponentially and is capped at 60 s", async () => {
        vi.mocked(Math.random).mockReturnValue(0.999999);
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
        const { client, mock, retries } = setup(() => errorResponse(503, "fixture_capacity"), { maxRetries: 9 });
        let finished = false;
        const promise = client.chat.completions.create(CHAT).finally(() => {
            finished = true;
        });
        promise.catch(() => undefined);
        for (let i = 0; i < 20 && !finished; i++) await vi.advanceTimersByTimeAsync(60_000);
        await expect(promise).rejects.toBeInstanceOf(InternalServerError);
        expect(mock.calls).toHaveLength(10);
        const waits = retries().map((d) => d.waitMs as number);
        expect(waits).toHaveLength(9);
        expect(waits[0]).toBeLessThanOrEqual(1_000);
        for (let i = 1; i < waits.length; i++) expect(waits[i]!).toBeGreaterThanOrEqual(waits[i - 1]!);
        expect(Math.max(...waits)).toBeLessThanOrEqual(60_000);
        expect(waits[waits.length - 1]!).toBeGreaterThan(59_000);
    });
});

describe("timeouts and signals (D8, block0 §3.9 item 7)", () => {
    it("an already-aborted signal rejects with its reason before any fetch", async () => {
        const { client, mock } = setup(() => jsonResponse(COMPLETION));
        const controller = new AbortController();
        const reason = new Error("stopped by caller");
        controller.abort(reason);
        await expect(client.chat.completions.create(CHAT, { signal: controller.signal })).rejects.toBe(reason);
        expect(mock.calls).toHaveLength(0);
    });

    it("a user abort during the request rethrows the abort reason unwrapped and is not retried", async () => {
        const { client, mock } = setup(hangUntilAborted);
        const controller = new AbortController();
        const reason = new Error("caller abort");
        const promise = client.chat.completions.create(CHAT, { signal: controller.signal });
        setTimeout(() => controller.abort(reason), 10);
        await expect(promise).rejects.toBe(reason);
        expect(mock.calls).toHaveLength(1);
    });

    it("the signal given inside params (3.x style) works too", async () => {
        const { client, mock } = setup(() => jsonResponse(COMPLETION));
        const controller = new AbortController();
        controller.abort(new Error("x"));
        await expect(client.chat.completions.create({ ...CHAT, signal: controller.signal })).rejects.toThrow("x");
        expect(mock.calls).toHaveLength(0);
    });

    it("the client timeout throws APITimeoutError (status 0) and is not retried", async () => {
        const { client, mock } = setup(hangUntilAborted, { timeout: 30 });
        const err = await client.chat.completions.create(CHAT).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(APITimeoutError);
        expect(err).toBeInstanceOf(APIConnectionError);
        expect(err).toBeInstanceOf(DevupAPIError);
        expect((err as APITimeoutError).status).toBe(0);
        expect((err as APITimeoutError).name).toBe("APITimeoutError");
        expect(mock.calls).toHaveLength(1);
    });

    it("a per-call timeout overrides the client timeout", async () => {
        const { client } = setup(hangUntilAborted);
        await expect(client.balance.retrieve({ timeout: 30 })).rejects.toBeInstanceOf(APITimeoutError);
    });

    it("the non-stream timeout covers reading the body", async () => {
        const { client } = setup(
            () => sseResponse(['{"balance_dzd":', "1}"], { delayMs: 150, headers: { "content-type": "application/json" } }),
            { timeout: 60, maxRetries: 0 },
        );
        await expect(client.balance.retrieve()).rejects.toBeInstanceOf(APITimeoutError);
    });

    it("the non-stream timeout covers the retries too (one deadline per call)", async () => {
        vi.spyOn(Math, "random").mockReturnValue(1);
        const { client, mock } = setup(() => errorResponse(503, "fixture_capacity", "busy", { "retry-after-ms": "40" }), { timeout: 100, maxRetries: 10 });
        const started = Date.now();
        const err = await client.chat.completions.create(CHAT).catch((e: unknown) => e);
        expect(Date.now() - started).toBeLessThan(1_000);
        expect(err).toBeInstanceOf(DevupAPIError);
        expect(mock.calls.length).toBeLessThan(5);
    });

    /** Wraps a caller signal so that every abort listener added to it or removed from it is recorded. */
    function countingSignal(): { signal: AbortSignal; added: unknown[]; removed: unknown[] } {
        const signal = new AbortController().signal;
        const added: unknown[] = [];
        const removed: unknown[] = [];
        const add = signal.addEventListener.bind(signal);
        const remove = signal.removeEventListener.bind(signal);
        signal.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, opts?: AddEventListenerOptions | boolean) => {
            if (type === "abort") added.push(listener);
            add(type, listener, opts);
        }) as typeof signal.addEventListener;
        signal.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, opts?: EventListenerOptions | boolean) => {
            if (type === "abort") removed.push(listener);
            remove(type, listener, opts);
        }) as typeof signal.removeEventListener;
        return { signal, added, removed };
    }

    it("the listener counter records listeners added through the caller's signal (self-check)", () => {
        const { signal, added, removed } = countingSignal();
        const listener = (): void => undefined;
        signal.addEventListener("abort", listener);
        signal.removeEventListener("abort", listener);
        expect(added).toEqual([listener]);
        expect(removed).toEqual([listener]);
    });

    it.each([
        ["a successful call", () => jsonResponse(COMPLETION)],
        ["an error response", () => errorResponse(400, "fixture_invalid")],
        ["a retried call", sequence(errorResponse(503, "fixture_capacity", "busy", { "retry-after-ms": "1" }), jsonResponse(COMPLETION))],
        ["a connection error", sequence(new TypeError("fetch failed"))],
    ] as const)("leaves no abort listener on the caller's signal after %s", async (_label, handler) => {
        vi.spyOn(Math, "random").mockReturnValue(0); // no backoff wait
        const { client } = setup(handler as Handler, { maxRetries: 1 });
        const { signal, added, removed } = countingSignal();
        await client.chat.completions.create(CHAT, { signal }).catch(() => undefined);
        // The SDK combines the caller's signal with its own timeout through AbortSignal.any,
        // so it never adds a listener to the caller's signal directly. If that changes,
        // every listener it adds must be removed by the end of the call.
        expect(added).toEqual([]);
        expect(removed.length).toBe(added.length);
        for (const listener of added) expect(removed).toContain(listener);
    });

    it("clears its timers after a call (fake timers)", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
        const { client } = setup(() => jsonResponse(COMPLETION));
        await client.chat.completions.create(CHAT, { timeout: 10_000 });
        expect(vi.getTimerCount()).toBe(0);
        await client.models.list().catch(() => undefined);
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe("errors (D9, block0 §3.9 item 9)", () => {
    it.each([
        [400, "DevupAPIError"],
        [401, "AuthenticationError"],
        [403, "PermissionDeniedError"],
        [404, "NotFoundError"],
        [409, "ConflictError"],
        [429, "RateLimitError"],
        [500, "InternalServerError"],
        [502, "InternalServerError"],
        [503, "InternalServerError"],
    ])("status %i → %s, still a DevupAPIError, with every field", async (status, name) => {
        const { client } = setup(
            () =>
                errorResponse(status, "fixture_invalid", "Fixture message.", { "retry-after-ms": "1500", "retry-after": "2", "X-DEVUP-Warnings": "fixture_notice_a,fixture_notice_b", "x-request-id": REQ_ID }, "messages"),
            { maxRetries: 0 },
        );
        const err = await client.chat.completions.create(CHAT).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(DevupAPIError);
        expect(err).toBeInstanceOf(Error);
        const e = err as DevupAPIError;
        expect(e.name).toBe(name);
        expect(e.constructor.name).toBe(name);
        expect(e.status).toBe(status);
        expect(e.message).toBe("Fixture message.");
        expect(e.type).toBe("devup_error");
        const code: string | undefined = e.code;
        expect(code).toBe("fixture_invalid");
        expect(e.param).toBe("messages");
        expect(e.requestId).toBe(REQ_ID);
        expect(e.retryAfter).toBe("2");
        expect(e.retryAfterMs).toBe(1500);
        expect(e.warnings).toEqual(["fixture_notice_a", "fixture_notice_b"]);
        expect(e.headers["x-request-id"]).toBe(REQ_ID);
        expect(Object.keys(e.headers).every((k) => k === k.toLowerCase())).toBe(true);
    });

    it("param is null and retryAfterMs is null when absent", async () => {
        const { client } = setup(() => errorResponse(400, "fixture_invalid"), { maxRetries: 0 });
        const e = (await client.balance.retrieve().catch((x: unknown) => x)) as DevupAPIError;
        expect(e.param).toBeNull();
        expect(e.retryAfterMs).toBeNull();
        expect(e.retryAfter).toBeNull();
        expect(e.warnings).toEqual([]);
    });

    it("makeAPIError picks the subclass", () => {
        const h = new Headers({ "x-request-id": REQ_ID });
        expect(makeAPIError(401, "m", undefined, h)).toBeInstanceOf(AuthenticationError);
        expect(makeAPIError(403, "m", undefined, h)).toBeInstanceOf(PermissionDeniedError);
        expect(makeAPIError(404, "m", undefined, h)).toBeInstanceOf(NotFoundError);
        expect(makeAPIError(409, "m", { code: "fixture_conflict" }, h)).toBeInstanceOf(ConflictError);
        expect(makeAPIError(429, "m", undefined, h)).toBeInstanceOf(RateLimitError);
        expect(makeAPIError(500, "m", undefined, h)).toBeInstanceOf(InternalServerError);
        expect(makeAPIError(504, "m", undefined, h)).toBeInstanceOf(InternalServerError);
        const plain = makeAPIError(400, "m", { code: "fixture_invalid", param: "model" }, h);
        expect(plain.constructor).toBe(DevupAPIError);
        expect(plain.param).toBe("model");
        expect(plain.requestId).toBe(REQ_ID);
    });

    it("parseRetryAfterMs reads retry-after-ms, then seconds, then an HTTP date", () => {
        const now = Date.parse("2026-11-01T10:00:00.000Z");
        expect(parseRetryAfterMs(new Headers({ "retry-after-ms": "1500" }), now)).toBe(1500);
        expect(parseRetryAfterMs(new Headers({ "retry-after-ms": "250", "retry-after": "9" }), now)).toBe(250);
        expect(parseRetryAfterMs(new Headers({ "retry-after": "3" }), now)).toBe(3000);
        expect(parseRetryAfterMs(new Headers({ "retry-after": new Date(now + 5000).toUTCString() }), now)).toBe(5000);
        expect(parseRetryAfterMs(new Headers({ "retry-after": "not a date" }), now)).toBeNull();
        expect(parseRetryAfterMs(new Headers(), now)).toBeNull();
    });

    it("parseWarnings splits X-DEVUP-Warnings on commas, trims and drops empties", () => {
        expect(parseWarnings(new Headers({ "X-DEVUP-Warnings": " fixture_notice_a ,fixture_notice_b,, " }))).toEqual(["fixture_notice_a", "fixture_notice_b"]);
        expect(parseWarnings(new Headers())).toEqual([]);
    });
});

describe("API key and header values (m1)", () => {
    const NUL = String.fromCharCode(0);
    const KEY_MESSAGE = "apiKey contains characters that are not allowed in an HTTP header.";
    const headerMessage = (name: string): string => `Header "${name}" has a value that is not allowed in an HTTP header.`;

    it.each([
        ["LF", "fixture-secret-key\nX-Fixture: 1"],
        ["CR", "fixture-secret-key\rX-Fixture: 1"],
        ["CRLF", "fixture-secret-key\r\nX-Fixture: 1"],
        ["NUL", `fixture-secret-key${NUL}`],
    ])("an apiKey with %s makes the constructor throw a TypeError that does not contain the key", (_label, apiKey) => {
        const mock = mockFetch(() => jsonResponse({ balance_dzd: 1 }));
        let err: unknown;
        try {
            new DevupAI({ apiKey, fetch: mock.fetch });
        } catch (e: unknown) {
            err = e;
        }
        expect(err).toBeInstanceOf(TypeError);
        const message = (err as TypeError).message;
        expect(message).toBe(KEY_MESSAGE);
        expect(message).not.toContain("fixture-secret-key");
        expect(String((err as TypeError).stack)).not.toContain("fixture-secret-key");
        expect(mock.calls).toHaveLength(0);
    });

    it("an empty apiKey still constructs, and health.check works without a key", async () => {
        const mock = mockFetch(() => jsonResponse({ status: "ok" }));
        const client = new DevupAI({ apiKey: "", fetch: mock.fetch });
        await expect(client.health.check()).resolves.toEqual({ status: "ok" });
        expect(mock.calls).toHaveLength(1);
        expect(mock.last().method).toBe("GET");
        expect(mock.last().headers.has("authorization")).toBe(false);
    });

    it.each([
        ["LF", "fixture-secret-value\nX-Injected: 1"],
        ["CR", "fixture-secret-value\rX-Injected: 1"],
        ["CRLF", "fixture-secret-value\r\nX-Injected: 1"],
        ["NUL", `fixture-secret-value${NUL}`],
    ])("a per-call header value with %s rejects with a TypeError naming the header only, before any fetch, not retried", async (_label, value) => {
        const { client, mock, events } = setup(() => jsonResponse({ balance_dzd: 1 }), { maxRetries: 2 });
        const err = await client.balance.retrieve({ headers: { "X-Fixture": value } }).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(TypeError);
        expect(err).not.toBeInstanceOf(DevupAPIError);
        const message = (err as TypeError).message;
        expect(message).toBe(headerMessage("X-Fixture"));
        expect(message).not.toContain("fixture-secret-value");
        expect(String((err as TypeError).stack)).not.toContain("fixture-secret-value");
        expect(mock.calls).toHaveLength(0);
        expect(events).toEqual([]);
    });

    it("a client-level header value with LF makes each call reject the same way, before any fetch", async () => {
        const { client, mock, events } = setup(() => jsonResponse({ balance_dzd: 1 }), {
            maxRetries: 2,
            headers: { "X-Fixture-Global": "fixture-secret-value\nX-Injected: 1" },
        });
        const err = await client.chat.completions.create(CHAT).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(TypeError);
        expect((err as TypeError).message).toBe(headerMessage("X-Fixture-Global"));
        expect((err as TypeError).message).not.toContain("fixture-secret-value");
        expect(mock.calls).toHaveLength(0);
        expect(events).toEqual([]);
    });

    it("an invalid caller header name rejects with a TypeError before any fetch, without echoing the name", async () => {
        const { client, mock, events } = setup(() => jsonResponse({ balance_dzd: 1 }));
        const err = await client.balance.retrieve({ headers: { "X-Fixture\nsecret-name": "1" } }).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(TypeError);
        expect((err as TypeError).message).not.toContain("secret-name");
        expect(mock.calls).toHaveLength(0);
        expect(events).toEqual([]);
    });

    it("valid caller header values are still sent", async () => {
        const { client, mock } = setup(() => jsonResponse({ balance_dzd: 1 }), { headers: { "X-Fixture-Global": "a b\tc" } });
        await client.balance.retrieve({ headers: { "X-Fixture": "fixture-value" } });
        expect(mock.last().headers.get("x-fixture")).toBe("fixture-value");
        expect(mock.last().headers.get("x-fixture-global")).toBe("a b\tc");
    });
});

describe("onDebug hook errors", () => {
    beforeEach(() => {
        vi.spyOn(Math, "random").mockReturnValue(0); // full jitter → no wait
    });

    it("a throwing onDebug hook does not change the outcome of a retried status error", async () => {
        const onDebug = vi.fn<(e: DebugEvent) => void>(() => {
            throw new Error("fixture hook error");
        });
        const { client, mock } = setup(sequence(errorResponse(503, "fixture_capacity", "busy", { "retry-after-ms": "1" }), jsonResponse(COMPLETION)), { onDebug });
        await expect(client.chat.completions.create(CHAT)).resolves.toStrictEqual(COMPLETION);
        expect(mock.calls).toHaveLength(2);
        expect(onDebug).toHaveBeenCalledTimes(1);
        expect(onDebug).toHaveBeenCalledWith({ type: "retry", detail: { attempt: 1, status: 503, waitMs: 1 } });
    });

    it("a throwing onDebug hook does not change the outcome of a retried connection error", async () => {
        const onDebug = vi.fn<(e: DebugEvent) => void>(() => {
            throw new Error("fixture hook error");
        });
        const { client, mock } = setup(sequence(new TypeError("fetch failed"), jsonResponse(COMPLETION)), { onDebug });
        await expect(client.chat.completions.create(CHAT)).resolves.toStrictEqual(COMPLETION);
        expect(mock.calls).toHaveLength(2);
        expect(onDebug).toHaveBeenCalledWith({ type: "retry", detail: { attempt: 1, status: 0, waitMs: 0 } });
    });

    it("a throwing onDebug hook does not replace the final error", async () => {
        const onDebug = vi.fn<(e: DebugEvent) => void>(() => {
            throw new Error("fixture hook error");
        });
        const { client, mock } = setup(() => errorResponse(503, "fixture_capacity", "busy", { "retry-after-ms": "1" }), { onDebug, maxRetries: 1 });
        const err = await client.chat.completions.create(CHAT).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(InternalServerError);
        expect((err as DevupAPIError).code).toBe("fixture_capacity");
        expect(mock.calls).toHaveLength(2);
        expect(onDebug).toHaveBeenCalledTimes(1);
    });
});

describe("User-Agent (D10, block0 §3.9 item 11)", () => {
    it("sends User-Agent: devupai-node/<package.json version> on every request", async () => {
        const { client, mock } = setup(() => jsonResponse({ object: "list", data: [] }));
        await client.models.list();
        await client.health.check();
        await client.images.download(`${BASE}/images/proxy?d=a&s=b`);
        expect(mock.calls).toHaveLength(3);
        for (const req of mock.calls) expect(req.headers.get("user-agent")).toBe(`devupai-node/${PKG_VERSION}`);
    });

    it("VERSION is the package.json version", () => {
        expect(VERSION).toBe(PKG_VERSION);
    });

    it("caller headers may override User-Agent", async () => {
        const { client, mock } = setup(() => jsonResponse({ balance_dzd: 1 }), { headers: { "user-agent": "fixture-app/1" } });
        await client.balance.retrieve();
        expect(mock.last().headers.get("user-agent")).toBe("fixture-app/1");
    });
});
