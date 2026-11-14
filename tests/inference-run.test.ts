// D5: inference.run() with a JSON payload (unchanged), a FormData payload, and a binary answer.
import { describe, expect, expectTypeOf, it } from "vitest";
import DevupAI, { type APIPromise } from "../src/index";
import { BASE, MODEL_A, MODEL_B, REQ_ID, TEST_KEY, headerNames, jsonResponse, mockFetch, type Handler } from "./helpers/mock-fetch";

function setup(handler: Handler) {
    const mock = mockFetch(handler);
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0 });
    return { mock, client };
}

const BYTES = new Uint8Array([1, 2, 3, 4]);
function binaryResponse(): Response {
    return new Response(BYTES, { status: 200, headers: { "content-type": "application/octet-stream", "x-request-id": REQ_ID } });
}

describe("inference.run: JSON payload (D5)", () => {
    it("(a) the JSON body is unchanged byte for byte", async () => {
        const { client, mock } = setup(() => jsonResponse({ ok: true }));
        const result = await client.inference.run(MODEL_B, { inputs: "hello", options: { top_k: 2 }, flag: true }, { headers: { "X-Fixture": "1" } });
        const req = mock.last();
        expect(req.method).toBe("POST");
        expect(req.url).toBe(`${BASE}/inference/fixture%2Fmodel-b`);
        expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
        expect(req.headers.get("content-type")).toBe("application/json");
        expect(req.headers.get("accept")).toBe("application/json");
        expect(req.headers.get("x-fixture")).toBe("1");
        // Captured from the JSON-only implementation: the exact string it sent for this payload.
        expect(req.text).toBe('{"inputs":"hello","options":{"top_k":2},"flag":true}');
        expect(result).toEqual({ ok: true });
    });

    it("(d) responseType \"json\" behaves like no option", async () => {
        const { client, mock } = setup(() => jsonResponse({ ok: true }));
        const result = await client.inference.run(MODEL_B, { inputs: "hello" }, { responseType: "json", headers: { "X-Fixture": "1" } });
        const req = mock.last();
        expect(req.url).toBe(`${BASE}/inference/fixture%2Fmodel-b`);
        expect(req.headers.get("accept")).toBe("application/json");
        expect(req.headers.get("content-type")).toBe("application/json");
        expect(req.headers.get("x-fixture")).toBe("1");
        expect(req.text).toBe('{"inputs":"hello"}');
        expect(headerNames(req)).not.toContain("responsetype");
        expect(result).toEqual({ ok: true });
    });
});

describe("inference.run: FormData payload (D5)", () => {
    it("(b) a FormData payload is sent as it is, without a Content-Type set by the SDK", async () => {
        const { client, mock } = setup(() => jsonResponse({ ok: true }));
        const form = new FormData();
        form.append("file", new Blob([BYTES]), "input.bin");
        form.append("mode", "fast");
        const result = await client.inference.run(MODEL_A, form);
        const req = mock.last();
        expect(req.method).toBe("POST");
        expect(req.url).toBe(`${BASE}/inference/fixture%2Fmodel-a`);
        expect(req.body).toBe(form);
        expect(req.form!.get("mode")).toBe("fast");
        expect(req.form!.get("file")).toBeInstanceOf(Blob);
        expect(req.headers.get("content-type")).toBeNull();
        expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
        expect(result).toEqual({ ok: true });
    });
});

describe("inference.run: binary answer (D5)", () => {
    it("(c) responseType \"binary\" resolves with the Response, body unread, Accept */*", async () => {
        const { client, mock } = setup(() => binaryResponse());
        const response = await client.inference.run(MODEL_A, { input: "x" }, { responseType: "binary", headers: { "X-Fixture": "1" } });
        expect(response).toBeInstanceOf(Response);
        expect(response.bodyUsed).toBe(false);
        expect(response.headers.get("content-type")).toBe("application/octet-stream");
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);

        const req = mock.last();
        expect(req.url).toBe(`${BASE}/inference/fixture%2Fmodel-a`);
        expect(req.headers.get("accept")).toBe("*/*");
        expect(req.headers.get("content-type")).toBe("application/json");
        expect(req.headers.get("x-fixture")).toBe("1");
        expect(req.text).toBe('{"input":"x"}');
        // `responseType` is an SDK option: it is neither a header nor part of the body.
        expect(headerNames(req)).not.toContain("responsetype");
        expect(headerNames(req).sort()).toEqual(["accept", "authorization", "content-type", "user-agent", "x-fixture"]);
    });

    it("(c) withResponse() of a binary answer carries the request id and the unread response", async () => {
        const { client } = setup(() => binaryResponse());
        const { data, response, requestId } = await client.inference.run(MODEL_A, { input: "x" }, { responseType: "binary" }).withResponse();
        expect(data).toBe(response);
        expect(requestId).toBe(REQ_ID);
        expect(response.bodyUsed).toBe(false);
    });

    it("(c) a FormData payload with a binary answer", async () => {
        const { client, mock } = setup(() => binaryResponse());
        const form = new FormData();
        form.append("mode", "fast");
        const response = await client.inference.run(MODEL_A, form, { responseType: "binary" });
        expect(response.bodyUsed).toBe(false);
        const req = mock.last();
        expect(req.body).toBe(form);
        expect(req.headers.get("accept")).toBe("*/*");
        expect(req.headers.get("content-type")).toBeNull();
    });
});

describe("inference.run: types (D5)", () => {
    it("(e) explicit generics and the binary overload compile", () => {
        const { client } = setup(() => jsonResponse({ ok: true }));
        const typed = client.inference.run<{ ok: boolean }, { input: string }>(MODEL_A, { input: "x" });
        expectTypeOf(typed).toEqualTypeOf<APIPromise<{ ok: boolean }>>();
        const plain = client.inference.run(MODEL_A, { input: "x" });
        expectTypeOf(plain).toEqualTypeOf<APIPromise<unknown>>();
        const json = client.inference.run<{ ok: boolean }>(MODEL_A, { input: "x" }, { responseType: "json" });
        expectTypeOf(json).toEqualTypeOf<APIPromise<{ ok: boolean }>>();
        const binary = client.inference.run(MODEL_A, { input: "x" }, { responseType: "binary" });
        expectTypeOf(binary).toEqualTypeOf<APIPromise<Response>>();
        const formBinary = client.inference.run(MODEL_A, new FormData(), { responseType: "binary" });
        expectTypeOf(formBinary).toEqualTypeOf<APIPromise<Response>>();
        // Only the types are checked here; the promises are left unawaited on purpose.
        expect(typeof typed.then).toBe("function");
    });
});
