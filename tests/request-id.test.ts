// The `x-client-request-id` response header on `withResponse()` and on `DevupAPIError`.
import { describe, expect, it } from "vitest";
import DevupAI, { DevupAPIError, type WithResponse } from "../src/index";
import { MODEL_A, REQ_ID, REQ_ID_2, TEST_KEY, errorResponse, jsonResponse, mockFetch, realChatStream, sseResponse, type Handler } from "./helpers/mock-fetch";

/** A synthetic correlation id in the accepted character set. */
const CLIENT_ID = "fixture-client.id_01:a";

function setup(handler: Handler) {
    const mock = mockFetch(handler);
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0 });
    return { mock, client };
}

describe("x-client-request-id", () => {
    it("withResponse() exposes clientRequestId from the header; requestId is unchanged", async () => {
        const { client, mock } = setup(() =>
            jsonResponse({ object: "list", data: [] }, { headers: { "x-request-id": REQ_ID_2, "x-client-request-id": CLIENT_ID } }),
        );
        const result: WithResponse<unknown> = await client.models.list({ headers: { "x-client-request-id": CLIENT_ID } }).withResponse();
        expect(mock.last().headers.get("x-client-request-id")).toBe(CLIENT_ID);
        expect(result.requestId).toBe(REQ_ID_2);
        expect(result.clientRequestId).toBe(CLIENT_ID);
        expect(result.response.headers.get("x-client-request-id")).toBe(CLIENT_ID);
        expect(Object.keys(result).sort()).toEqual(["clientRequestId", "data", "requestId", "response", "warnings"]);
    });

    it("clientRequestId is null when the header is absent", async () => {
        const { client } = setup(() => jsonResponse({ balance_dzd: 1 }));
        const { requestId, clientRequestId } = await client.balance.retrieve().withResponse();
        expect(requestId).toBe(REQ_ID);
        expect(clientRequestId).toBeNull();
    });

    it("clientRequestId is set on a raw response too", async () => {
        const { client } = setup(() => new Response("x", { status: 200, headers: { "x-request-id": REQ_ID, "x-client-request-id": CLIENT_ID } }));
        const { clientRequestId, requestId } = await client.images.download("https://api.devupai.com/v1/images/proxy?d=a&s=b").withResponse();
        expect(clientRequestId).toBe(CLIENT_ID);
        expect(requestId).toBe(REQ_ID);
    });

    it("a DevupAPIError from a 400 carries clientRequestId and requestId", async () => {
        const { client } = setup(() => errorResponse(400, "fixture_invalid", "Fixture message.", { "x-client-request-id": CLIENT_ID }));
        const err = await client.chat.completions.create({ model: MODEL_A, messages: [] }).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(DevupAPIError);
        const e = err as DevupAPIError;
        expect(e.status).toBe(400);
        expect(e.code).toBe("fixture_invalid");
        expect(e.requestId).toBe(REQ_ID);
        expect(e.clientRequestId).toBe(CLIENT_ID);
        expect(e.headers["x-client-request-id"]).toBe(CLIENT_ID);
    });

    it("a DevupAPIError without the header has clientRequestId null", async () => {
        const { client } = setup(() => errorResponse(400, "fixture_invalid"));
        const e = (await client.balance.retrieve().catch((x: unknown) => x)) as DevupAPIError;
        expect(e.clientRequestId).toBeNull();
        expect(e.requestId).toBe(REQ_ID);
    });

    it("a DevupAPIError constructed without headers has clientRequestId null", () => {
        const e = new DevupAPIError(0, "Fixture.");
        expect(e.clientRequestId).toBeNull();
        expect(e.requestId).toBeNull();
    });

    it("a stream exposes clientRequestId from the header, next to requestId; null when absent", async () => {
        const params = { model: MODEL_A, messages: [{ role: "user" as const, content: "Hi" }], stream: true as const };
        const { client } = setup(() => sseResponse(realChatStream(), { headers: { "x-client-request-id": CLIENT_ID } }));
        const stream = await client.chat.completions.create(params);
        expect(stream.requestId).toBe(REQ_ID);
        expect(stream.clientRequestId).toBe(CLIENT_ID);
        for await (const _ of stream) void _;

        const plain = setup(() => sseResponse(realChatStream()));
        const other = await plain.client.chat.completions.create(params);
        expect(other.clientRequestId).toBeNull();
        for await (const _ of other) void _;
    });
});
