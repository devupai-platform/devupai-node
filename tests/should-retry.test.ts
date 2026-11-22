// `x-should-retry: false` (4.3.1): an answer that carries it is never sent again, whatever its
// status, the method or `maxRetries`. The check runs in the one place the client decides on a
// new attempt after an error status (src/core/client.ts), before the status rules, so it covers
// every method, `.withResponse()` and streams (the decision is made on the headers, before the
// first chunk). Only `false` is honoured: `x-should-retry: true` never widens the retries.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DevupAI, { DevupAPIError, type ClientOptions, type DebugEvent } from "../src/index";
import { MODEL_A, TEST_KEY, errorResponse, jsonResponse, mockFetch, sequence, type Handler } from "./helpers/mock-fetch";

function setup(handler: Handler, options: Partial<ClientOptions> = {}) {
    const mock = mockFetch(handler);
    const events: DebugEvent[] = [];
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, onDebug: (e) => events.push(e), ...options });
    return { mock, client, retries: () => events.filter((e) => e.type === "retry") };
}

type Call = (client: DevupAI) => PromiseLike<unknown>;
const chat: Call = (c) => c.chat.completions.create({ model: MODEL_A, messages: [{ role: "user", content: "Hi" }] });
const FALSE = { "x-should-retry": "false" };

async function attempts(handler: Handler, call: Call = chat, options: Partial<ClientOptions> = {}) {
    const t = setup(handler, options);
    const error = await Promise.resolve(call(t.client)).then(
        () => null,
        (e: unknown) => e
    );
    return { calls: t.mock.calls.length, error, retries: t.retries() };
}

beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0); // no wait between attempts
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("x-should-retry: false on a billed POST", () => {
    it("503 + false: exactly 1 attempt, the usual error, no retry event", async () => {
        const r = await attempts(() => errorResponse(503, "service_unavailable", "busy", { ...FALSE, "Retry-After": "5" }));
        expect(r.calls).toBe(1);
        expect(r.error).toBeInstanceOf(DevupAPIError);
        expect((r.error as DevupAPIError).status).toBe(503);
        expect((r.error as DevupAPIError).code).toBe("service_unavailable");
        expect(r.retries).toEqual([]);
    });

    it("429 + false: 1 attempt", async () => {
        const r = await attempts(() => errorResponse(429, "rate_limit_exceeded", "busy", { ...FALSE, "retry-after-ms": "1" }));
        expect(r.calls).toBe(1);
        expect((r.error as DevupAPIError).status).toBe(429);
    });

    it("503 with no header: retries as before (maxRetries 2 → 3 attempts)", async () => {
        const r = await attempts(() => errorResponse(503, "service_unavailable", "busy"));
        expect(r.calls).toBe(3);
    });

    it("503 + true: the same attempt count as with no header (true never widens retries)", async () => {
        const none = await attempts(() => errorResponse(503, "service_unavailable", "busy"));
        const withTrue = await attempts(() => errorResponse(503, "service_unavailable", "busy", { "x-should-retry": "true" }));
        expect(withTrue.calls).toBe(none.calls);
        expect(withTrue.calls).toBe(3);
    });

    it("502 + true on a billed POST: still 1 attempt (a billed POST never retries 502)", async () => {
        const r = await attempts(() => errorResponse(502, "DEVUP_COMPUTE_ERROR", "x", { "x-should-retry": "true" }));
        expect(r.calls).toBe(1);
    });

    it("`X-Should-Retry: FALSE ` (case and spaces): 1 attempt", async () => {
        const r = await attempts(() => errorResponse(503, "service_unavailable", "busy", { "X-Should-Retry": "FALSE " }));
        expect(r.calls).toBe(1);
    });

    it("a larger maxRetries does not change it", async () => {
        const r = await attempts(() => errorResponse(503, "service_unavailable", "busy", FALSE), chat, { maxRetries: 10 });
        expect(r.calls).toBe(1);
    });

    it("the error is the same as without the header", async () => {
        const withFalse = await attempts(() => errorResponse(503, "c", "busy", FALSE), chat, { maxRetries: 0 });
        const without = await attempts(() => errorResponse(503, "c", "busy"), chat, { maxRetries: 0 });
        const a = withFalse.error as DevupAPIError;
        const b = without.error as DevupAPIError;
        expect(a.constructor).toBe(b.constructor);
        expect([a.status, a.code, a.message]).toEqual([b.status, b.code, b.message]);
    });
});

describe("x-should-retry: false on every path", () => {
    it("a not billed GET with 502 + false: 1 attempt", async () => {
        const r = await attempts(() => errorResponse(502, "x", "x", FALSE), (c) => c.models.list());
        expect(r.calls).toBe(1);
    });

    it("a not billed GET with 502 and no header still retries", async () => {
        const r = await attempts(sequence(errorResponse(502, "x", "x"), jsonResponse({ object: "list", data: [] })), (c) => c.models.list());
        expect(r.error).toBeNull();
        expect(r.calls).toBe(2);
    });

    it("a stream request that gets 503 + false: 1 attempt", async () => {
        const r = await attempts(
            () => errorResponse(503, "service_unavailable", "busy", FALSE),
            (c) => c.chat.completions.create({ model: MODEL_A, messages: [{ role: "user", content: "Hi" }], stream: true })
        );
        expect(r.calls).toBe(1);
        expect((r.error as DevupAPIError).status).toBe(503);
    });

    it.each<[string, Call]>([
        ["embeddings.create", (c) => c.embeddings.create({ model: MODEL_A, input: "x" })],
        ["rerank.create", (c) => c.rerank.create({ model: MODEL_A, query: "q", documents: ["a"] })],
        ["inference.run", (c) => c.inference.run(MODEL_A, { input: "x" })],
        ["inference.run (binary)", (c) => c.inference.run(MODEL_A, { input: "x" }, { responseType: "binary" })],
        ["responses.create (stream)", (c) => c.responses.create({ model: MODEL_A, input: "Hi", stream: true })],
        ["chat.completions.create().withResponse()", (c) => c.chat.completions.create({ model: MODEL_A, messages: [{ role: "user", content: "Hi" }] }).withResponse()],
    ])("%s with 503 + false: 1 attempt", async (_name, call) => {
        const r = await attempts(() => errorResponse(503, "service_unavailable", "busy", FALSE), call);
        expect(r.calls).toBe(1);
        expect(r.error).toBeInstanceOf(DevupAPIError);
    });
});
