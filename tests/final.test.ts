import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import DevupAI, { APIConnectionError, DevupAPIError, RateLimitError, type VideoKeyPoint } from "../src/index";
import {
    BASE,
    DONE,
    MODEL_A,
    REQ_ID,
    TEST_KEY,
    dataEvent,
    jsonResponse,
    mockFetch,
    sequence,
    sseResponse,
    type Handler,
} from "./helpers/mock-fetch";

function makeClient(handler: Handler) {
    const mock = mockFetch(handler);
    return { mock, client: new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0 }) };
}

describe("DEVUP AI SDK 4.x - Final Requirements", () => {
    describe("1. images.download URL preservation", () => {
        it("fetches the URL exactly as returned in data[].url", async () => {
            const { client, mock } = makeClient(() => new Response("image-data", { headers: { "content-type": "image/png" } }));

            const rawUrls = [
                `${BASE}/images/proxy?d=abc&s=%2F`,
                `${BASE}/images/proxy?d=abc&s=%20`,
                `${BASE}/images/proxy?d=abc&s=%25`,
                `${BASE}/images/proxy?d=abc&s=+`,
                `${BASE}/images/proxy?d=abc&s==`,
                `${BASE}/images/proxy?d=signed%2Bquery&s=sig`,
                `${BASE}/images/proxy?d=nested&s=b&extra=1`,
            ];

            for (const url of rawUrls) {
                const response = await client.images.download(url);
                expect(response).toBeInstanceOf(Response);
                const req = mock.last();
                expect(req.url).toBe(url);
                expect(req.method).toBe("GET");
                expect(req.headers.has("authorization")).toBe(false);
                expect(new URL(req.url).searchParams.get("d")).toBe(new URL(url).searchParams.get("d"));
                expect(new URL(req.url).searchParams.get("s")).toBe(new URL(url).searchParams.get("s"));
            }
            expect(mock.calls).toHaveLength(rawUrls.length);
        });
    });

    describe("2. Chat Cleanup Guarantee", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it("cleans up on network error", async () => {
            const { client } = makeClient(sequence(new Error("NetFail")));
            const err = await client.chat.completions.create({ model: MODEL_A, messages: [], timeout: 10000 }).catch((e: unknown) => e);
            expect(err).toBeInstanceOf(APIConnectionError);
            expect(((err as APIConnectionError).cause as Error).message).toBe("NetFail");
            expect(vi.getTimerCount()).toBe(0); // no timer remains
        });

        it("cleans up on JSON parse error", async () => {
            const { client } = makeClient(() => new Response("{ malformed", { headers: { "content-type": "application/json" } }));
            await expect(client.chat.completions.create({ model: MODEL_A, messages: [], timeout: 10000 })).rejects.toThrow();
            expect(vi.getTimerCount()).toBe(0);
        });

        it("cleans up on successful JSON", async () => {
            const { client } = makeClient(() => jsonResponse({ id: "ok" }));
            await client.chat.completions.create({ model: MODEL_A, messages: [], timeout: 10000 });
            expect(vi.getTimerCount()).toBe(0);
        });

        it("cleans up on stream completion", async () => {
            const { client } = makeClient(() => sseResponse([DONE]));
            const iter = await client.chat.completions.create({ model: MODEL_A, messages: [], stream: true, timeout: 10000 });
            for await (const _chunk of iter) {
                /* empty */
            }
            expect(vi.getTimerCount()).toBe(0);
        });

        it("cleans up on stream cancelled early", async () => {
            const onCancel = vi.fn();
            const { client } = makeClient(() => sseResponse([dataEvent({ choices: [] })], { keepOpen: true, onCancel }));
            const iter = await client.chat.completions.create({ model: MODEL_A, messages: [], stream: true, timeout: 10000 });
            for await (const _chunk of iter) {
                break;
            }
            expect(onCancel).toHaveBeenCalled();
            expect(vi.getTimerCount()).toBe(0);
        });
    });

    describe("3. Transcription Coverage", () => {
        it("supports all response formats", async () => {
            const { client, mock } = makeClient((req) => {
                const format = req.form?.get("response_format");
                if (format === "json" || format === "verbose_json") {
                    return jsonResponse({ text: "test", _devup: { request_id: REQ_ID } });
                }
                return new Response("mocked", { headers: { "content-type": "text/plain" } });
            });

            const text: string = await client.audio.transcriptions.create({ file: new Blob(), model: MODEL_A, response_format: "text" });
            const srt: string = await client.audio.transcriptions.create({ file: new Blob(), model: MODEL_A, response_format: "srt" });
            const vtt: string = await client.audio.transcriptions.create({ file: new Blob(), model: MODEL_A, response_format: "vtt" });
            const json = await client.audio.transcriptions.create({ file: new Blob(), model: MODEL_A, response_format: "json" });

            expect([text, srt, vtt]).toEqual(["mocked", "mocked", "mocked"]);
            expect(json.text).toBe("test");
            expect(mock.calls.map((c) => c.form?.get("response_format"))).toEqual(["text", "srt", "vtt", "json"]);
            expect(mock.calls.every((c) => c.url === `${BASE}/audio/transcriptions` && c.method === "POST")).toBe(true);
        });
    });

    describe("4. Error Coverage", () => {
        it("handles non-Error thrown values", async () => {
            const thrown: unknown[] = ["WeirdStringError", { some: "obj" }];
            for (const value of thrown) {
                const { client } = makeClient(() => {
                    throw value;
                });
                const err = await client.models.list().catch((e: unknown) => e);
                expect(err).toBeInstanceOf(APIConnectionError);
                expect((err as APIConnectionError).cause).toBe(value);
                expect((err as APIConnectionError).message.length).toBeGreaterThan(0);
            }
        });

        it("handles empty response body", async () => {
            const { client } = makeClient(() => new Response("", { status: 500, statusText: "Server Error", headers: { "content-type": "text/plain" } }));
            const err = await client.models.list().catch((e: unknown) => e);
            expect(err).toBeInstanceOf(DevupAPIError);
            expect((err as DevupAPIError).status).toBe(500);
            expect((err as DevupAPIError).message).toMatch(/HTTP 500|Server Error/);
        });

        it("extracts X-Request-Id and Retry-After", async () => {
            const { client } = makeClient(() =>
                jsonResponse({ error: { message: "msg" } }, { status: 429, headers: { "x-request-id": "req-123", "retry-after": "60" } }),
            );
            const err = await client.models.list().catch((e: unknown) => e);
            expect(err).toBeInstanceOf(RateLimitError);
            const e = err as RateLimitError;
            expect(e.requestId).toBe("req-123");
            expect(e.retryAfter).toBe("60");
            expect(e.retryAfterMs).toBe(60000);
        });
    });

    describe("5. Key Points Array Types", () => {
        it("supports strongly typed key_points array", async () => {
            const { client, mock } = makeClient(() => jsonResponse({ data: [], _devup: {} }));
            const points: VideoKeyPoint[] = [{ x: 10, y: 20, type: "positive" }];
            await client.video.edits.create({ model: MODEL_A, video: new Blob(), prompt: "test", key_points: points });
            const req = mock.last();
            expect(req.url).toBe(`${BASE}/video/generations`);
            expect(req.form?.get("key_points")).toBe(JSON.stringify(points));
        });
    });
});
