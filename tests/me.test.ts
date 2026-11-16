// The account profile resource (`GET /me`, `GET /me/avatar`).
import { describe, expect, it } from "vitest";
import DevupAI, { NotFoundError, type AccountProfile } from "../src/index";
import { BASE, REQ_ID, TEST_KEY, errorResponse, jsonResponse, mockFetch, type Handler } from "./helpers/mock-fetch";

function setup(handler: Handler) {
    const mock = mockFetch(handler);
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0 });
    return { mock, client };
}

const ETAG = '"fixture-etag"';

const PROFILE: AccountProfile = {
    object: "account_profile",
    display_name: "Fixture Name",
    initial: "F",
    email_hint: "f•••@example.com",
    avatar: { url: `${BASE}/me/avatar`, etag: ETAG },
};

const PNG_BYTES = new Uint8Array([137, 80, 78, 71]);

function avatarResponse(): Response {
    return new Response(PNG_BYTES, {
        status: 200,
        headers: { "content-type": "image/png", etag: ETAG, "Cache-Control": "private, max-age=86400", "x-request-id": REQ_ID },
    });
}

describe("me.retrieve", () => {
    it("GET /me with the Bearer key and Accept: application/json; resolves with the profile", async () => {
        const { client, mock } = setup(() => jsonResponse(PROFILE, { headers: { "Cache-Control": "private, max-age=300" } }));
        const profile = await client.me.retrieve();
        const req = mock.last();
        expect(req.method).toBe("GET");
        expect(req.url).toBe(`${BASE}/me`);
        expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
        expect(req.headers.get("accept")).toBe("application/json");
        expect(req.body).toBeNull();
        expect(profile).toStrictEqual(PROFILE);
        expect(profile.avatar?.etag).toBe(ETAG);
    });

    it("withResponse() gives the request id and the response", async () => {
        const { client } = setup(() => jsonResponse(PROFILE));
        const { data, response, requestId } = await client.me.retrieve().withResponse();
        expect(data).toStrictEqual(PROFILE);
        expect(response.status).toBe(200);
        expect(requestId).toBe(REQ_ID);
    });
});

describe("me.avatar", () => {
    it("GET /me/avatar with the Bearer key; resolves with the Response, body unread", async () => {
        const { client, mock } = setup(() => avatarResponse());
        const response = await client.me.avatar();
        const req = mock.last();
        expect(req.method).toBe("GET");
        expect(req.url).toBe(`${BASE}/me/avatar`);
        expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
        expect(req.headers.has("if-none-match")).toBe(false);
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.bodyUsed).toBe(false);
        expect(response.headers.get("etag")).toBe(ETAG);
        expect(response.headers.get("content-type")).toBe("image/png");
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
    });

    it("ifNoneMatch sends If-None-Match, and a 304 resolves with the 304 Response", async () => {
        const { client, mock } = setup(
            () => new Response(null, { status: 304, headers: { etag: ETAG, "Cache-Control": "private, max-age=86400", "x-request-id": REQ_ID } }),
        );
        const response = await client.me.avatar({ ifNoneMatch: ETAG });
        expect(mock.last().headers.get("if-none-match")).toBe(ETAG);
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(304);
        expect(response.headers.get("etag")).toBe(ETAG);
        expect(await response.text()).toBe("");
    });

    it("ifNoneMatch that no longer matches: a 200 resolves with the bytes as usual", async () => {
        const { client, mock } = setup(() => avatarResponse());
        const response = await client.me.avatar({ ifNoneMatch: '"fixture-old-etag"' });
        expect(mock.last().headers.get("if-none-match")).toBe('"fixture-old-etag"');
        expect(response.status).toBe(200);
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
    });

    it("withResponse() on a 304 gives the status, the request id and the ETag", async () => {
        const { client } = setup(() => new Response(null, { status: 304, headers: { etag: ETAG, "x-request-id": REQ_ID } }));
        const { data, response, requestId } = await client.me.avatar({ ifNoneMatch: ETAG }).withResponse();
        expect(data).toBe(response);
        expect(response.status).toBe(304);
        expect(response.headers.get("etag")).toBe(ETAG);
        expect(requestId).toBe(REQ_ID);
    });

    it("ifNoneMatch combines with other request options", async () => {
        const { client, mock } = setup(() => avatarResponse());
        await client.me.avatar({ ifNoneMatch: ETAG, headers: { "X-Fixture": "1" } });
        const req = mock.last();
        expect(req.url).toBe(`${BASE}/me/avatar`);
        expect(req.headers.get("x-fixture")).toBe("1");
        expect(req.headers.get("if-none-match")).toBe(ETAG);
    });

    it("404 avatar_not_found throws NotFoundError with the code", async () => {
        const { client } = setup(() => errorResponse(404, "avatar_not_found", "This account has no profile picture."));
        const err = await client.me.avatar().catch((e: unknown) => e);
        expect(err).toBeInstanceOf(NotFoundError);
        expect((err as NotFoundError).code).toBe("avatar_not_found");
        expect((err as NotFoundError).status).toBe(404);
        expect((err as NotFoundError).requestId).toBe(REQ_ID);
    });
});
