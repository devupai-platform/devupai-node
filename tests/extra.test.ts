import { describe, it, expect, vi, beforeEach, } from 'vitest';
import DevupAI from '../src/index';

const mockedFetch = vi.fn();
global.fetch = mockedFetch;

describe('DEVUP AI SDK V3 - Extra Error and Type Coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetAllMocks();
    });

    const client = new DevupAI({ apiKey: 'test' });

    describe('Transcription Optional Model', () => {
        it('does not append undefined model to FormData', async () => {
            mockedFetch.mockResolvedValueOnce(new Response(JSON.stringify({ text: "test" })));
            await client.audio.transcriptions.create({ file: new Blob(["test"]) });
            const reqInit = mockedFetch.mock.lastCall![1];
            const body = reqInit.body as FormData;
            expect(body.has("model")).toBe(false);
        });
    });

    describe('Error Message Fallback', () => {

        it('malformed json with non-empty body', async () => {
            mockedFetch.mockResolvedValueOnce(new Response("{ malformed ", { status: 400, statusText: "Bad Request", headers: { 'content-type': 'application/json' } }));
            await expect(client.models.list()).rejects.toThrow('{ malformed ');
        });

        it('malformed json with empty statusText', async () => {
            mockedFetch.mockResolvedValueOnce(new Response("raw text", { status: 400, statusText: "", headers: { 'content-type': 'application/json' } }));
            await expect(client.models.list()).rejects.toThrow('raw text');
        });

        it('empty body with empty statusText', async () => {
            mockedFetch.mockResolvedValueOnce(new Response("", { status: 500, statusText: "" }));
            await expect(client.models.list()).rejects.toThrow('HTTP 500');
        });

        it('valid JSON error envelope', async () => {
            mockedFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "JSON msg" } }), { status: 401, headers: { 'content-type': 'application/json' } }));
            await expect(client.models.list()).rejects.toThrow('JSON msg');
        });

        it('text/plain error', async () => {
            mockedFetch.mockResolvedValueOnce(new Response("text error", { status: 503, headers: { 'content-type': 'text/plain' } }));
            await expect(client.models.list()).rejects.toThrow('text error');
        });

        it('deterministic network error for unknown throws', async () => {
            mockedFetch.mockRejectedValueOnce({ toString: () => "Weird throw" });
            await expect(client.models.list()).rejects.toThrow('Network error: Weird throw');
        });
    });
});
