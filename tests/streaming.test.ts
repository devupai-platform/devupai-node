// D5 (one chunk type, usage on the final chunk, error frames, malformed frames) and the SSE parser.
import { describe, it, expect, vi } from "vitest";
import DevupAI, { APIConnectionError, APITimeoutError, DevupAPIError, Stream, type ChatCompletionChunk, type DebugEvent } from "../src/index";
import { SSEParser, type ServerSentEvent } from "../src/core/streaming";
import {
    BASE,
    DONE,
    MODEL_A,
    REQ_ID,
    TEST_KEY,
    USAGE,
    chunk,
    dataEvent,
    mockFetch,
    realChatStream,
    sseResponse,
    type Handler,
} from "./helpers/mock-fetch";

function setup(handler: Handler, options: { onDebug?: (e: DebugEvent) => void; streamIdleTimeout?: number; timeout?: number } = {}) {
    const mock = mockFetch(handler);
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0, ...options });
    return { mock, client };
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
    const out: T[] = [];
    for await (const item of stream) out.push(item);
    return out;
}

const params = { model: MODEL_A, messages: [{ role: "user" as const, content: "Hi" }], stream: true as const };

describe("chat stream (D5, block0 §3.9 items 2, 3, 4, 6)", () => {
    it("sends stream and stream_options in the body, and yields the real shape with usage on the final chunk", async () => {
        const { client, mock } = setup(() => sseResponse(realChatStream()));
        const stream = await client.chat.completions.create({ ...params, stream_options: { include_usage: true } });
        expect(stream).toBeInstanceOf(Stream);

        const req = mock.last();
        expect(req.method).toBe("POST");
        expect(req.url).toBe(`${BASE}/chat/completions`);
        expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
        expect(req.headers.get("content-type")).toBe("application/json");
        expect(req.json).toEqual({ ...params, stream_options: { include_usage: true } });

        const chunks: ChatCompletionChunk[] = await collect(stream);
        expect(chunks).toHaveLength(4);
        expect(chunks.map((c) => c.choices[0]?.delta.content ?? null)).toEqual(["", "Hello", " world", null]);
        expect(chunks.slice(0, 3).every((c) => c.usage === undefined)).toBe(true);
        const last = chunks[3]!;
        expect(last.choices).toEqual([]);
        const total: number | undefined = last.usage?.total_tokens; // typed access, no cast
        expect(total).toBe(12);
        expect(last.usage).toEqual(USAGE);
        expect(last.service_tier).toBe("default");
        expect(chunks.some((c) => c._devup !== undefined)).toBe(false);
    });

    it("exposes response, requestId and warnings on the stream (D6)", async () => {
        const { client } = setup(() => sseResponse(realChatStream(), { headers: { "x-devup-warnings": "fixture_notice_a, fixture_notice_b" } }));
        const stream = await client.chat.completions.create(params);
        expect(stream.response).toBeInstanceOf(Response);
        expect(stream.response.status).toBe(200);
        expect(stream.requestId).toBe(REQ_ID);
        expect(stream.warnings).toEqual(["fixture_notice_a", "fixture_notice_b"]);
        await collect(stream);
    });

    it("withResponse() on a stream gives the request id before reading the body (D6, §3.9 item 10)", async () => {
        const { client } = setup(() => sseResponse(realChatStream()));
        const { data, response, requestId, warnings } = await client.chat.completions.create(params).withResponse();
        expect(data).toBeInstanceOf(Stream);
        expect(response.headers.get("content-type")).toBe("text/event-stream");
        expect(requestId).toBe(REQ_ID);
        expect(warnings).toEqual([]);
        expect(await collect(data)).toHaveLength(4);
    });

    it("an in-stream error frame throws DevupAPIError with the frame code and the stream request id", async () => {
        const { client } = setup(() =>
            sseResponse([
                dataEvent(chunk({ choices: [{ index: 0, delta: { content: "Hel" }, finish_reason: null }] })),
                dataEvent({ error: { message: "The request could not be completed.", type: "devup_error", code: "fixture_conflict" } }),
                DONE,
            ]),
        );
        const stream = await client.chat.completions.create(params);
        const seen: ChatCompletionChunk[] = [];
        const err = await (async () => {
            for await (const c of stream) seen.push(c);
        })().catch((e: unknown) => e);
        expect(seen).toHaveLength(1);
        expect(err).toBeInstanceOf(DevupAPIError);
        const apiErr = err as DevupAPIError;
        expect(apiErr.code).toBe("fixture_conflict");
        expect(apiErr.type).toBe("devup_error");
        expect(apiErr.message).toBe("The request could not be completed.");
        expect(apiErr.requestId).toBe(REQ_ID);
        expect(apiErr.status).toBe(200);
    });

    it("a malformed frame goes to onDebug and is skipped, never silently", async () => {
        const onDebug = vi.fn<(e: DebugEvent) => void>();
        const { client } = setup(
            () =>
                sseResponse([
                    dataEvent(chunk({ choices: [{ index: 0, delta: { content: "a" }, finish_reason: null }] })),
                    "data: {not json}\n\n",
                    dataEvent(chunk({ choices: [{ index: 0, delta: { content: "b" }, finish_reason: "stop" }] })),
                    DONE,
                ]),
            { onDebug },
        );
        const chunks = await collect(await client.chat.completions.create(params));
        expect(chunks.map((c) => c.choices[0]?.delta.content)).toEqual(["a", "b"]);
        const malformed = onDebug.mock.calls.map((c) => c[0]).filter((e) => e.type === "malformed_frame");
        expect(malformed).toHaveLength(1);
        expect(malformed[0]!.detail.data).toBe("{not json}");
    });

    it("a malformed frame without onDebug does not break the stream", async () => {
        const { client } = setup(() => sseResponse(["data: {oops\n\n", dataEvent(chunk({ choices: [] })), DONE]));
        expect(await collect(await client.chat.completions.create(params))).toHaveLength(1);
    });
});

describe("SSE parsing", () => {
    it("joins multi-line data with a newline, ignores comments and other fields, tolerates CRLF", async () => {
        const { client } = setup(() =>
            sseResponse([
                ": keep-alive\r\n\r\n",
                'id: 1\r\nretry: 1000\r\ndata: {"id":"chatcmpl-1","object":"chat.completion.chunk",\r\n',
                'data: "created":1,"model":"fixture/model-a","choices":[]}\r\n\r\n',
                "data: [DONE]\r\n\r\n",
            ]),
        );
        const chunks = await collect(await client.chat.completions.create(params));
        expect(chunks).toEqual([{ id: "chatcmpl-1", object: "chat.completion.chunk", created: 1, model: MODEL_A, choices: [] }]);
    });

    it("handles events split across network chunks byte by byte, including UTF-8 characters", async () => {
        const text = "مرحبا é 👋";
        const bytes = new TextEncoder().encode(dataEvent(chunk({ choices: [{ index: 0, delta: { content: text }, finish_reason: null }] })) + DONE);
        const pieces = Array.from(bytes, (b) => new Uint8Array([b]));
        const { client } = setup(() => sseResponse(pieces));
        const chunks = await collect(await client.chat.completions.create(params));
        expect(chunks).toHaveLength(1);
        expect(chunks[0]!.choices[0]!.delta.content).toBe(text);
    });

    // An event is dispatched only when a blank line ends it (WHATWG event-stream rules).
    // A final event that the body leaves unterminated is not yielded: its data goes to
    // onDebug as a `malformed_frame`, and the stream ends normally.
    it.each([
        ["ends with a single newline", "\n"],
        ["ends with no newline", ""],
    ])("a body without [DONE] whose last event %s yields the complete events only and reports the last one to onDebug", async (_label, ending) => {
        const onDebug = vi.fn<(e: DebugEvent) => void>();
        const lastData = JSON.stringify(chunk({ choices: [], usage: USAGE }));
        const { client } = setup(() => sseResponse([dataEvent(chunk({ choices: [] })), `data: ${lastData}${ending}`]), { onDebug });
        const chunks = await collect(await client.chat.completions.create(params));
        expect(chunks).toHaveLength(1);
        expect(chunks[0]!.choices).toEqual([]);
        expect(chunks[0]!.usage).toBeUndefined();
        expect(onDebug.mock.calls).toEqual([[{ type: "malformed_frame", detail: { data: lastData } }]]);
    });

    it("a body without [DONE] whose last event is complete ends the stream normally with no debug event", async () => {
        const onDebug = vi.fn<(e: DebugEvent) => void>();
        const { client } = setup(() => sseResponse([dataEvent(chunk({ choices: [] })), dataEvent(chunk({ choices: [], usage: USAGE }))]), { onDebug });
        const chunks = await collect(await client.chat.completions.create(params));
        expect(chunks).toHaveLength(2);
        expect(chunks[1]!.usage).toEqual(USAGE);
        expect(onDebug).not.toHaveBeenCalled();
    });

    it("one large event delivered in many small chunks is parsed whole", async () => {
        const text = "é👋 fixture ".repeat(4000); // ~60 KB of UTF-8 in one event
        const bytes = new TextEncoder().encode(dataEvent(chunk({ choices: [{ index: 0, delta: { content: text }, finish_reason: null }] })) + DONE);
        const pieces: Uint8Array[] = [];
        for (let i = 0; i < bytes.length; i += 13) pieces.push(bytes.slice(i, i + 13));
        expect(pieces.length).toBeGreaterThan(1000);
        const onDebug = vi.fn<(e: DebugEvent) => void>();
        const { client } = setup(() => sseResponse(pieces), { onDebug });
        const chunks = await collect(await client.chat.completions.create(params));
        expect(chunks).toHaveLength(1);
        expect(chunks[0]!.choices[0]!.delta.content).toBe(text);
        expect(onDebug).not.toHaveBeenCalled();
    });

    it("ends at [DONE] and ignores anything after it", async () => {
        const { client } = setup(() => sseResponse([dataEvent(chunk({ choices: [] })), DONE, dataEvent(chunk({ choices: [] }))]));
        expect(await collect(await client.chat.completions.create(params))).toHaveLength(1);
    });

    it("breaking out of the loop cancels the body", async () => {
        const onCancel = vi.fn();
        const { client } = setup(() => sseResponse([dataEvent(chunk({ choices: [] })), dataEvent(chunk({ choices: [] }))], { keepOpen: true, onCancel }));
        const stream = await client.chat.completions.create(params);
        for await (const _c of stream) break;
        expect(onCancel).toHaveBeenCalled();
    });

    it("abort() cancels the body", async () => {
        const onCancel = vi.fn();
        const { client } = setup(() => sseResponse([dataEvent(chunk({ choices: [] }))], { keepOpen: true, onCancel }));
        const stream = await client.chat.completions.create(params);
        stream.abort();
        await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
    });
});

describe("SSEParser (incremental scan)", () => {
    it("a large multi-line event pushed one character at a time is returned once, by the push that ends it", () => {
        const parser = new SSEParser();
        const lineA = "a".repeat(20_000);
        const lineB = "b".repeat(20_000);
        const input = `event: fixture\ndata: ${lineA}\ndata: ${lineB}\n\ndata: next\n\n`;
        const results: Array<{ at: number; events: ServerSentEvent[] }> = [];
        for (let i = 0; i < input.length; i++) {
            const events = parser.push(input[i]!);
            if (events.length > 0) results.push({ at: i, events });
        }
        const firstEnd = input.indexOf("\n\n", input.indexOf(lineB)) + 1;
        expect(results).toEqual([
            { at: firstEnd, events: [{ event: "fixture", data: `${lineA}\n${lineB}` }] },
            { at: input.length - 1, events: [{ event: null, data: "next" }] },
        ]);
        expect(parser.end()).toBeNull();
    });

    it("a CRLF split across two pushes is one line break", () => {
        const parser = new SSEParser();
        expect(parser.push("data: x\r")).toEqual([]);
        expect(parser.push("\ndata: y\r")).toEqual([]);
        expect(parser.push("\n\r")).toEqual([{ event: null, data: "x\ny" }]);
        expect(parser.push("\n")).toEqual([]);
        expect(parser.end()).toBeNull();
    });

    it("text after a partial line is joined to it, in chunks of any size", () => {
        const input = `data: ${"z".repeat(5_000)}\n\n`;
        for (const size of [1, 2, 7, 64, 4_096]) {
            const parser = new SSEParser();
            const events: ServerSentEvent[] = [];
            for (let i = 0; i < input.length; i += size) events.push(...parser.push(input.slice(i, i + size)));
            expect(events, `size ${size}`).toEqual([{ event: null, data: "z".repeat(5_000) }]);
            expect(parser.end()).toBeNull();
        }
    });

    it("end() returns the data of an unterminated event", () => {
        const parser = new SSEParser();
        expect(parser.push("data: partial")).toEqual([]);
        expect(parser.end()).toBe("partial");
    });
});

describe("errors while reading the stream body", () => {
    it("a network error during iteration throws APIConnectionError (a DevupAPIError) with the cause and the response headers", async () => {
        const cause = new Error("connection reset");
        const { client, mock } = setup(() => sseResponse([dataEvent(chunk({ choices: [] }))], { errorAfter: cause }));
        const stream = await client.chat.completions.create(params);
        const seen: unknown[] = [];
        const err = await (async () => {
            for await (const c of stream) seen.push(c);
        })().catch((e: unknown) => e);
        expect(seen).toHaveLength(1);
        expect(err).toBeInstanceOf(APIConnectionError);
        expect(err).toBeInstanceOf(DevupAPIError);
        expect(err).not.toBeInstanceOf(APITimeoutError);
        const e = err as APIConnectionError;
        expect(e.status).toBe(0);
        expect(e.message).toBe("Network error: connection reset");
        expect(e.cause).toBe(cause);
        expect(e.requestId).toBe(REQ_ID);
        expect(mock.calls).toHaveLength(1);
    });

    it("a user abort through the request signal during iteration is not turned into APIConnectionError", async () => {
        const controller = new AbortController();
        const reason = new Error("fixture caller abort");
        const encoder = new TextEncoder();
        // Like a real fetch: the body errors with the signal's reason when the signal aborts.
        const { client } = setup((req) => {
            const body = new ReadableStream<Uint8Array>({
                start(streamController) {
                    streamController.enqueue(encoder.encode(dataEvent(chunk({ choices: [] }))));
                    req.signal?.addEventListener("abort", () => streamController.error(req.signal?.reason), { once: true });
                },
            });
            return new Response(body, { status: 200, headers: { "content-type": "text/event-stream", "x-request-id": REQ_ID } });
        });
        const stream = await client.chat.completions.create(params, { signal: controller.signal });
        const seen: unknown[] = [];
        const err = await (async () => {
            for await (const c of stream) {
                seen.push(c);
                controller.abort(reason);
            }
        })().catch((e: unknown) => e);
        expect(seen).toHaveLength(1);
        expect(err).toBe(reason);
        expect(err).not.toBeInstanceOf(APIConnectionError);
    });

    it("stream.abort() during iteration ends the loop without an error", async () => {
        const onCancel = vi.fn();
        const { client } = setup(() => sseResponse([dataEvent(chunk({ choices: [] })), dataEvent(chunk({ choices: [] }))], { keepOpen: true, onCancel }));
        const stream = await client.chat.completions.create(params);
        const seen: unknown[] = [];
        for await (const c of stream) {
            seen.push(c);
            stream.abort();
        }
        expect(seen.length).toBeGreaterThanOrEqual(1);
        await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
    });
});

describe("onDebug hook errors in a stream", () => {
    it("a throwing onDebug hook on a malformed frame does not change the stream", async () => {
        const onDebug = vi.fn<(e: DebugEvent) => void>(() => {
            throw new Error("fixture hook error");
        });
        const { client } = setup(
            () =>
                sseResponse([
                    dataEvent(chunk({ choices: [{ index: 0, delta: { content: "a" }, finish_reason: null }] })),
                    "data: {not json}\n\n",
                    dataEvent(chunk({ choices: [{ index: 0, delta: { content: "b" }, finish_reason: "stop" }] })),
                    DONE,
                ]),
            { onDebug },
        );
        const chunks = await collect(await client.chat.completions.create(params));
        expect(chunks.map((c) => c.choices[0]?.delta.content)).toEqual(["a", "b"]);
        expect(onDebug).toHaveBeenCalledTimes(1);
        expect(onDebug).toHaveBeenCalledWith({ type: "malformed_frame", detail: { data: "{not json}" } });
    });

    it("a throwing onDebug hook on an unterminated final event still ends the stream normally", async () => {
        const onDebug = vi.fn<(e: DebugEvent) => void>(() => {
            throw new Error("fixture hook error");
        });
        const { client } = setup(() => sseResponse([dataEvent(chunk({ choices: [] })), "data: {partial"]), { onDebug });
        const chunks = await collect(await client.chat.completions.create(params));
        expect(chunks).toHaveLength(1);
        expect(onDebug).toHaveBeenCalledWith({ type: "malformed_frame", detail: { data: "{partial" } });
    });
});

describe("stream timeouts (D8)", () => {
    it("the request timeout covers only the time until headers, not the whole stream", async () => {
        const { client } = setup(() => sseResponse([...realChatStream()], { delayMs: 40 }), { timeout: 60 });
        const chunks = await collect(await client.chat.completions.create(params));
        expect(chunks).toHaveLength(4); // the body took ~200 ms, more than the 60 ms timeout
    });

    it("streamIdleTimeout aborts with APITimeoutError when no bytes arrive for that long, and cancels the body", async () => {
        const onCancel = vi.fn();
        const { client } = setup(() => sseResponse([dataEvent(chunk({ choices: [] }))], { keepOpen: true, onCancel }), { streamIdleTimeout: 50 });
        const stream = await client.chat.completions.create(params);
        const seen: unknown[] = [];
        const err = await (async () => {
            for await (const c of stream) seen.push(c);
        })().catch((e: unknown) => e);
        expect(seen).toHaveLength(1);
        expect(err).toBeInstanceOf(APITimeoutError);
        expect((err as APITimeoutError).status).toBe(0);
        await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
    });

    it("per-call streamIdleTimeout overrides the client option", async () => {
        const { client } = setup(() => sseResponse([dataEvent(chunk({ choices: [] })), DONE], { delayMs: 60 }), { streamIdleTimeout: 20 });
        const chunks = await collect(await client.chat.completions.create(params, { streamIdleTimeout: 1000 }));
        expect(chunks).toHaveLength(1);
    });

    it("an error in the body after the first byte is not retried", async () => {
        const mock = mockFetch(() => sseResponse([dataEvent(chunk({ choices: [] }))], { errorAfter: new Error("connection reset") }));
        const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 2 });
        const stream = await client.chat.completions.create(params);
        await expect(collect(stream)).rejects.toBeInstanceOf(APIConnectionError);
        expect(mock.calls).toHaveLength(1);
    });
});
