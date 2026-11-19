// A 304 answer to a GET that sends If-None-Match through `headers` gives the same result as
// the `ifNoneMatch` option: `null` for a JSON method, the 304 Response for a raw one.
import { describe, expect, it } from "vitest";
import DevupAI, { DevupAPIError } from "../src/index";
import { MODEL_A, REQ_ID, TEST_KEY, jsonResponse, mockFetch, type Handler } from "./helpers/mock-fetch";

const ETAG = '"fixture-etag"';

function setup(handler: Handler, headers?: Record<string, string>) {
    const mock = mockFetch(handler);
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0, headers });
    return { mock, client };
}

function notModified(): Response {
    return new Response(null, { status: 304, headers: { etag: ETAG, "x-request-id": REQ_ID } });
}

describe("If-None-Match through headers", () => {
    it.each([
        ["the ifNoneMatch option", { ifNoneMatch: ETAG }],
        ["If-None-Match in headers", { headers: { "If-None-Match": ETAG } }],
        ["if-none-match in headers (lower case)", { headers: { "if-none-match": ETAG } }],
    ] as const)("models.list with %s resolves null on a 304, with the 304 response", async (_label, options) => {
        const { client, mock } = setup(() => notModified());
        const { data, response, requestId } = await client.models.list(options).withResponse();
        expect(mock.last().headers.get("if-none-match")).toBe(ETAG);
        expect(data).toBeNull();
        expect(response.status).toBe(304);
        expect(requestId).toBe(REQ_ID);
    });

    it.each([
        ["the ifNoneMatch option", { ifNoneMatch: ETAG }],
        ["If-None-Match in headers", { headers: { "If-None-Match": ETAG } }],
    ] as const)("models.retrieve with %s resolves null on a 304", async (_label, options) => {
        const { client } = setup(() => notModified());
        const result: unknown = await client.models.retrieve(MODEL_A, options);
        expect(result).toBeNull();
    });

    it("an If-None-Match set in the client headers gives null on a 304 too", async () => {
        const { client } = setup(() => notModified(), { "If-None-Match": ETAG });
        const result: unknown = await client.models.list();
        expect(result).toBeNull();
    });

    it.each([
        ["the ifNoneMatch option", { ifNoneMatch: ETAG }],
        ["If-None-Match in headers", { headers: { "If-None-Match": ETAG } }],
    ] as const)("me.avatar with %s resolves with the 304 Response", async (_label, options) => {
        const { client } = setup(() => notModified());
        const response = await client.me.avatar(options);
        expect(response.status).toBe(304);
    });

    it("with If-None-Match in headers, a 200 still resolves with the body", async () => {
        const { client } = setup(() => jsonResponse({ object: "list", data: [] }, { headers: { etag: ETAG } }));
        await expect(client.models.list({ headers: { "If-None-Match": '"fixture-old"' } })).resolves.toEqual({ object: "list", data: [] });
    });

    it("without If-None-Match, a 304 still throws DevupAPIError with status 304", async () => {
        const { client } = setup(() => notModified());
        const err = await client.models.list({ headers: { "X-Fixture": "1" } }).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(DevupAPIError);
        expect((err as DevupAPIError).status).toBe(304);
    });

    it("a POST with If-None-Match in headers is not a conditional request: a 304 throws", async () => {
        const { client } = setup(() => notModified());
        const err = await client.embeddings.create({ model: MODEL_A, input: "x" }, { headers: { "If-None-Match": ETAG } }).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(DevupAPIError);
        expect((err as DevupAPIError).status).toBe(304);
    });
});
