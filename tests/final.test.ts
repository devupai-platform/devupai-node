import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DevupAI, { VideoKeyPoint } from '../src/index';

const mockedFetch = vi.fn();
global.fetch = mockedFetch;

describe('DEVUP AI SDK V3 - Final Requirements', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    const client = new DevupAI({ apiKey: 'test' });

    describe('1. Image Proxy URL Preservation', () => {
        it('preserves exact URL and uses URLSearchParams', async () => {
            mockedFetch.mockImplementation(() => Promise.resolve(new Response("image-data")));

            const rawUrls = [
                'https://example.com/img?q=%2F',
                'https://example.com/img?q=%20',
                'https://example.com/img?q=%25',
                'https://example.com/img?q=+',
                'https://example.com/img?q==',
                'https://example.com/img?Signature=signed%2Bquery',
                'https://example.com/img?q=nested&a=b'
            ];

            for (const url of rawUrls) {
                await client.images.proxy({ url });
                const req = mockedFetch.mock.lastCall![0] as string;
                expect(req.startsWith('https://api.devupai.com/v1/images/proxy')).toBe(true);
                const reqUrl = new URL(req);
                expect(reqUrl.searchParams.get('url')).toBe(url);
            }
        });
    });

    describe('2. Chat Cleanup Guarantee', () => {
        it('cleans up on network error', async () => {
            mockedFetch.mockRejectedValueOnce(new Error("NetFail"));
            await expect(client.chat.completions.create({ model: 'a', messages: [], timeout: 10000 })).rejects.toThrow('NetFail');
            expect(vi.getTimerCount()).toBe(0); // Proves no timeout remains
        });

        it('cleans up on JSON parse error', async () => {
            mockedFetch.mockImplementationOnce(() => Promise.resolve(new Response("{ malformed", { headers: { 'content-type': 'application/json' } })));
            await expect(client.chat.completions.create({ model: 'a', messages: [], timeout: 10000 })).rejects.toThrow();
            expect(vi.getTimerCount()).toBe(0);
        });

        it('cleans up on successful JSON', async () => {
            mockedFetch.mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ id: 'ok' }))));
            await client.chat.completions.create({ model: 'a', messages: [], timeout: 10000 });
            expect(vi.getTimerCount()).toBe(0);
        });

        it('cleans up on stream completion', async () => {
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                    controller.close();
                }
            });
            mockedFetch.mockImplementationOnce(() => Promise.resolve(new Response(stream, { headers: { 'content-type': 'text/event-stream' } })));
            const iter = await client.chat.completions.create({ model: 'a', messages: [], stream: true, timeout: 10000 }) as AsyncIterable<any>;
            for await (const _chunk of iter) { /* empty */ }
            expect(vi.getTimerCount()).toBe(0);
        });

        it('cleans up on stream cancelled early', async () => {
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode("data: {}\n\n"));
                }
            });
            mockedFetch.mockImplementationOnce(() => Promise.resolve(new Response(stream, { headers: { 'content-type': 'text/event-stream' } })));
            const iter = await client.chat.completions.create({ model: 'a', messages: [], stream: true, timeout: 10000 }) as AsyncIterable<any>;
            for await (const _chunk of iter) {
                break;
            }
            expect(vi.getTimerCount()).toBe(0);
        });
    });

    describe('3. Transcription Coverage', () => {
        it('supports all response formats at compile time', async () => {
            mockedFetch.mockImplementation(() => Promise.resolve(new Response("mocked")));

            await client.audio.transcriptions.create({ file: new Blob(), model: 'a', response_format: 'text' });
            await client.audio.transcriptions.create({ file: new Blob(), model: 'a', response_format: 'srt' });
            await client.audio.transcriptions.create({ file: new Blob(), model: 'a', response_format: 'vtt' });

            const jsonMock = vi.fn().mockReturnValue(Promise.resolve({ text: "test" }));
            mockedFetch.mockImplementationOnce(() => Promise.resolve({ ok: true, json: jsonMock } as unknown as Response));
            await client.audio.transcriptions.create({ file: new Blob(), model: 'a', response_format: 'json' });

            expect(mockedFetch).toHaveBeenCalledTimes(4);
        });
    });

    describe('4. Error Coverage', () => {
        it('handles non-Error thrown value with fallback', async () => {
            mockedFetch.mockRejectedValueOnce("WeirdStringError");
            await expect(client.models.list()).rejects.toThrow('Network error: WeirdStringError');

            mockedFetch.mockRejectedValueOnce({ some: 'obj' });
            await expect(client.models.list()).rejects.toThrow('Network error: Unknown error');
        });

        it('preserves AbortError', async () => {
            const e = new Error("Abort");
            e.name = "AbortError";
            mockedFetch.mockRejectedValueOnce(e);
            await expect(client.models.list()).rejects.toThrow('Abort');
        });

        it('handles empty response body text fallback', async () => {
            mockedFetch.mockImplementationOnce(() => Promise.resolve(new Response("", { status: 500, statusText: "Server Error", headers: { 'content-type': 'text/plain' } })));
            await expect(client.models.list()).rejects.toThrow('Server Error');
        });

        it('extracts X-Request-Id and Retry-After', async () => {
            mockedFetch.mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ error: { message: "msg" } }), {
                status: 429,
                headers: { 'content-type': 'application/json', 'x-request-id': 'req-123', 'retry-after': '60' }
            })));
            try {
                await client.models.list();
                throw new Error("Should not reach");
            } catch (e: any) {
                expect(e.requestId).toBe('req-123');
                expect(e.retryAfter).toBe('60');
            }
        });
    });

    describe('5. Key Points Array Types', () => {
        it('supports strongly typed key_points array', async () => {
            mockedFetch.mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({}))));
            const points: VideoKeyPoint[] = [{ x: 10, y: 20, type: 'positive' }];
            await client.video.edits.create({ video: new Blob(), prompt: 'test', key_points: points });
            const req = mockedFetch.mock.lastCall![1] as RequestInit;
            const body = req.body as FormData;
            expect(body.get('key_points')).toBe(JSON.stringify(points));
        });
    });

    });
