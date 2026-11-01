import { describe, it, expect } from "vitest";
import DevupAI, { APIConnectionError, DevupAPIError, InternalServerError } from "../src/index";
import { BASE, TEST_KEY, jsonResponse, mockFetch, sequence, type MockFetch } from "./helpers/mock-fetch";

/** A client that never retries, so each error test sees exactly one request. */
function clientFor(response: Response | { throws: unknown }): { client: DevupAI; mock: MockFetch } {
    const mock = mockFetch(
        response instanceof Response
            ? sequence(response)
            : () => {
                  throw response.throws;
              },
    );
    return { client: new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0 }), mock };
}

describe("DEVUP AI SDK 4.x - Extra Error and Type Coverage", () => {
    describe("Transcription Optional Model", () => {
        it("does not append undefined model to FormData", async () => {
            const { client, mock } = clientFor(jsonResponse({ text: "test", _devup: {} }));
            await client.audio.transcriptions.create({ file: new Blob(["test"]) });
            const req = mock.last();
            expect(req.url).toBe(`${BASE}/audio/transcriptions`);
            expect(req.method).toBe("POST");
            expect(req.form).toBeInstanceOf(FormData);
            expect(req.form?.has("model")).toBe(false);
            expect(req.form?.has("file")).toBe(true);
        });
    });

    describe("Error message when the body is not an error object", () => {
        it("malformed json with non-empty body", async () => {
            const { client } = clientFor(new Response("{ malformed ", { status: 400, statusText: "Bad Request", headers: { "content-type": "application/json" } }));
            await expect(client.models.list()).rejects.toThrow("{ malformed ");
        });

        it("malformed json with empty statusText", async () => {
            const { client } = clientFor(new Response("raw text", { status: 400, statusText: "", headers: { "content-type": "application/json" } }));
            await expect(client.models.list()).rejects.toThrow("raw text");
        });

        it("empty body with empty statusText", async () => {
            const { client, mock } = clientFor(new Response("", { status: 500, statusText: "" }));
            const err = await client.models.list().catch((e: unknown) => e);
            expect(err).toBeInstanceOf(InternalServerError);
            expect((err as DevupAPIError).message).toBe("HTTP 500");
            expect(mock.calls).toHaveLength(1);
        });

        it("valid JSON error envelope", async () => {
            const { client } = clientFor(jsonResponse({ error: { message: "JSON msg" } }, { status: 401 }));
            await expect(client.models.list()).rejects.toThrow("JSON msg");
        });

        it("text/plain error", async () => {
            const { client } = clientFor(new Response("text error", { status: 503, headers: { "content-type": "text/plain" } }));
            await expect(client.models.list()).rejects.toThrow("text error");
        });

        it("a non-Error thrown by fetch becomes an APIConnectionError with the value as cause", async () => {
            const thrown = { toString: () => "Weird throw" };
            const { client } = clientFor({ throws: thrown });
            const err = await client.models.list().catch((e: unknown) => e);
            expect(err).toBeInstanceOf(APIConnectionError);
            expect(err).toBeInstanceOf(DevupAPIError);
            expect((err as APIConnectionError).status).toBe(0);
            expect((err as APIConnectionError).cause).toBe(thrown);
        });
    });
});
