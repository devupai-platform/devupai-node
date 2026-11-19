// Conditional requests on `models.list` / `models.retrieve` (`If-None-Match` → 304 Not Modified).
import { describe, expect, expectTypeOf, it } from "vitest";
import DevupAI, { DevupAPIError, type APIPromise, type ConditionalRequestOptions, type ModelListResponse, type ModelObject, type RequestOptions } from "../src/index";
import { BASE, MODEL_A, REQ_ID, TEST_KEY, jsonResponse, mockFetch, type Handler } from "./helpers/mock-fetch";

const ETAG = '"fixture-models-etag"';

function setup(handler: Handler) {
    const mock = mockFetch(handler);
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0 });
    return { mock, client };
}

function notModified(): Response {
    return new Response(null, { status: 304, headers: { etag: ETAG, "Cache-Control": "private, max-age=300", "x-request-id": REQ_ID } });
}

const LIST: ModelListResponse = { object: "list", data: [] };
const MODEL = { id: MODEL_A, object: "model", owned_by: "fixture" } as unknown as ModelObject;

describe("models.list with ifNoneMatch", () => {
    it("sends If-None-Match and resolves null on 304", async () => {
        const { client, mock } = setup(() => notModified());
        const result = await client.models.list({ ifNoneMatch: ETAG });
        const req = mock.last();
        expect(req.method).toBe("GET");
        expect(req.url).toBe(`${BASE}/models`);
        expect(req.headers.get("if-none-match")).toBe(ETAG);
        expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
        expect(result).toBeNull();
    });

    it("withResponse() on a 304 gives status 304, the ETag and the request id", async () => {
        const { client } = setup(() => notModified());
        const { data, response, requestId, warnings } = await client.models.list({ ifNoneMatch: ETAG }).withResponse();
        expect(data).toBeNull();
        expect(response.status).toBe(304);
        expect(response.headers.get("etag")).toBe(ETAG);
        expect(requestId).toBe(REQ_ID);
        expect(warnings).toEqual([]);
    });

    it("ifNoneMatch that no longer matches: a 200 resolves with the list and its ETag", async () => {
        const { client, mock } = setup(() => jsonResponse(LIST, { headers: { etag: ETAG } }));
        const { data, response } = await client.models.list({ ifNoneMatch: '"fixture-old-etag"' }).withResponse();
        expect(mock.last().headers.get("if-none-match")).toBe('"fixture-old-etag"');
        expect(data).toEqual(LIST);
        expect(response.status).toBe(200);
        expect(response.headers.get("etag")).toBe(ETAG);
    });

    it("ifNoneMatch wins over an If-None-Match given in headers; other headers still pass", async () => {
        const { client, mock } = setup(() => notModified());
        await client.models.list({ ifNoneMatch: ETAG, headers: { "If-None-Match": '"fixture-other"', "X-Fixture": "1" } });
        const req = mock.last();
        expect(req.headers.get("if-none-match")).toBe(ETAG);
        expect(req.headers.get("x-fixture")).toBe("1");
    });

    it("without the option, a 200 is unchanged and no If-None-Match is sent", async () => {
        const { client, mock } = setup(() => jsonResponse(LIST, { headers: { etag: ETAG } }));
        const result = await client.models.list();
        expect(mock.last().headers.has("if-none-match")).toBe(false);
        expect(result).toEqual(LIST);
    });

    it("a 304 answer without ifNoneMatch still throws DevupAPIError with status 304", async () => {
        const { client } = setup(() => notModified());
        const err = await client.models.list().catch((e: unknown) => e);
        expect(err).toBeInstanceOf(DevupAPIError);
        const e = err as DevupAPIError;
        expect(e.constructor).toBe(DevupAPIError);
        expect(e.status).toBe(304);
        expect(e.message).toBe("HTTP 304");
        expect(e.code).toBeUndefined();
        expect(e.requestId).toBe(REQ_ID);
    });

    it("a 304 answer with If-None-Match given only as a header (not the option) resolves null, as the option does", async () => {
        const { client } = setup(() => notModified());
        const result: unknown = await client.models.list({ headers: { "If-None-Match": ETAG } });
        expect(result).toBeNull();
    });
});

describe("models.retrieve with ifNoneMatch", () => {
    it("sends If-None-Match and resolves null on 304", async () => {
        const { client, mock } = setup(() => notModified());
        const result = await client.models.retrieve(MODEL_A, { ifNoneMatch: ETAG });
        const req = mock.last();
        expect(req.url).toBe(`${BASE}/models/fixture%2Fmodel-a`);
        expect(req.headers.get("if-none-match")).toBe(ETAG);
        expect(result).toBeNull();
    });

    it("withResponse() on a 304 gives status 304 and the request id", async () => {
        const { client } = setup(() => notModified());
        const { data, response, requestId } = await client.models.retrieve(MODEL_A, { ifNoneMatch: ETAG }).withResponse();
        expect(data).toBeNull();
        expect(response.status).toBe(304);
        expect(requestId).toBe(REQ_ID);
    });

    it("a 200 with the option resolves with the model", async () => {
        const { client } = setup(() => jsonResponse(MODEL, { headers: { etag: ETAG } }));
        const result = await client.models.retrieve(MODEL_A, { ifNoneMatch: '"fixture-old-etag"' });
        expect(result).toEqual(MODEL);
    });

    it("a 304 answer without ifNoneMatch still throws DevupAPIError with status 304", async () => {
        const { client } = setup(() => notModified());
        const err = await client.models.retrieve(MODEL_A).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(DevupAPIError);
        expect((err as DevupAPIError).status).toBe(304);
    });
});

/** Compile-only: never called. The result type includes `null` only when `ifNoneMatch` may be set. */
function typeChecks(client: DevupAI): void {
    const plain: RequestOptions = {};
    const conditional: ConditionalRequestOptions & { ifNoneMatch: string } = { ifNoneMatch: ETAG };
    expectTypeOf(client.models.list()).toEqualTypeOf<APIPromise<ModelListResponse>>();
    expectTypeOf(client.models.list(plain)).toEqualTypeOf<APIPromise<ModelListResponse>>();
    expectTypeOf(client.models.list(conditional)).toEqualTypeOf<APIPromise<ModelListResponse | null>>();
    expectTypeOf(client.models.list({ ifNoneMatch: ETAG })).toEqualTypeOf<APIPromise<ModelListResponse | null>>();
    // A value that may or may not carry an entity tag: the result may be null.
    const maybe: ConditionalRequestOptions = {};
    expectTypeOf(client.models.list(maybe)).toEqualTypeOf<APIPromise<ModelListResponse | null>>();
    // An explicit undefined sends no If-None-Match, so the result is never null.
    expectTypeOf(client.models.list({ ifNoneMatch: undefined })).toEqualTypeOf<APIPromise<ModelListResponse>>();
    expectTypeOf(client.models.retrieve(MODEL_A)).toEqualTypeOf<APIPromise<ModelObject>>();
    expectTypeOf(client.models.retrieve(MODEL_A, plain)).toEqualTypeOf<APIPromise<ModelObject>>();
    expectTypeOf(client.models.retrieve(MODEL_A, conditional)).toEqualTypeOf<APIPromise<ModelObject | null>>();
    expectTypeOf(client.models.retrieve(MODEL_A, maybe)).toEqualTypeOf<APIPromise<ModelObject | null>>();
    expectTypeOf(client.me.avatar(conditional)).toEqualTypeOf<APIPromise<Response>>();
    expectTypeOf<ConditionalRequestOptions["ifNoneMatch"]>().toEqualTypeOf<string | undefined>();
    // ConditionalRequestOptions extends RequestOptions.
    const widened: RequestOptions = conditional;
    void widened;
}

describe("ConditionalRequestOptions typing", () => {
    it("the compile-only checks are part of this file", () => {
        expect(typeof typeChecks).toBe("function");
    });
});
