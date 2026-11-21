// HTTP 400, 402, 413 and 422 (added in 4.2.0) and 415 (added in 4.3.0) have their own subclasses of DevupAPIError.
// Every existing `instanceof DevupAPIError` keeps working, and the other statuses keep their class.
import { describe, expect, it } from "vitest";
import DevupAI, {
    AuthenticationError,
    BadRequestError,
    ConflictError,
    DevupAPIError,
    InternalServerError,
    NotFoundError,
    PayloadTooLargeError,
    PaymentRequiredError,
    PermissionDeniedError,
    RateLimitError,
    UnprocessableEntityError,
    UnsupportedMediaTypeError,
} from "../src/index";
import { makeAPIError } from "../src/core/errors";
import { MODEL_A, REQ_ID, TEST_KEY, errorResponse, mockFetch } from "./helpers/mock-fetch";

const NEW_CLASSES = [
    [400, BadRequestError, "BadRequestError", "invalid_value"],
    [402, PaymentRequiredError, "PaymentRequiredError", "insufficient_balance"],
    [413, PayloadTooLargeError, "PayloadTooLargeError", "payload_too_large"],
    [415, UnsupportedMediaTypeError, "UnsupportedMediaTypeError", "invalid_request_error"],
    [422, UnprocessableEntityError, "UnprocessableEntityError", "missing_required_parameter"],
] as const;

const OTHER_CLASSES = [
    [401, AuthenticationError, "AuthenticationError"],
    [403, PermissionDeniedError, "PermissionDeniedError"],
    [404, NotFoundError, "NotFoundError"],
    [409, ConflictError, "ConflictError"],
    [429, RateLimitError, "RateLimitError"],
    [500, InternalServerError, "InternalServerError"],
    [502, InternalServerError, "InternalServerError"],
    [503, InternalServerError, "InternalServerError"],
    [504, InternalServerError, "InternalServerError"],
] as const;

function client(status: number, code: string): { client: DevupAI } {
    const mock = mockFetch(() =>
        errorResponse(status, code, "Fixture message.", { "x-request-id": REQ_ID, "x-client-request-id": "fixture-client-id" }, "input"),
    );
    return { client: new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0 }) };
}

describe("error subclasses for 400, 402, 413, 415 and 422", () => {
    it.each(NEW_CLASSES)("status %i gives %o, a DevupAPIError with every field", async (status, cls, name, code) => {
        const err = await client(status, code).client.embeddings.create({ model: MODEL_A, input: "x" }).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(cls);
        expect(err).toBeInstanceOf(DevupAPIError);
        expect(err).toBeInstanceOf(Error);
        const e = err as DevupAPIError;
        expect(e.constructor).toBe(cls);
        expect(e.name).toBe(name);
        expect(e.status).toBe(status);
        expect(e.code).toBe(code);
        expect(e.type).toBe("devup_error");
        expect(e.param).toBe("input");
        expect(e.message).toBe("Fixture message.");
        expect(e.requestId).toBe(REQ_ID);
        expect(e.clientRequestId).toBe("fixture-client-id");
    });

    it.each(NEW_CLASSES)("makeAPIError(%i) picks %o", (status, cls) => {
        const e = makeAPIError(status, "m", { code: "fixture_code", param: "model" }, new Headers({ "x-request-id": REQ_ID }));
        expect(e).toBeInstanceOf(cls);
        expect(e).toBeInstanceOf(DevupAPIError);
        expect(e.code).toBe("fixture_code");
        expect(e.param).toBe("model");
        expect(e.requestId).toBe(REQ_ID);
    });

    it("the five classes extend DevupAPIError directly and are not instances of one another", () => {
        for (const [, cls] of NEW_CLASSES) {
            expect(Object.getPrototypeOf(cls)).toBe(DevupAPIError);
        }
        const bad = makeAPIError(400, "m", undefined, undefined);
        expect(bad).not.toBeInstanceOf(PaymentRequiredError);
        expect(bad).not.toBeInstanceOf(UnprocessableEntityError);
        expect(bad).not.toBeInstanceOf(PayloadTooLargeError);
        expect(bad).not.toBeInstanceOf(UnsupportedMediaTypeError);
        const unsupported = makeAPIError(415, "m", undefined, undefined);
        expect(unsupported).not.toBeInstanceOf(BadRequestError);
        expect(unsupported).not.toBeInstanceOf(UnprocessableEntityError);
    });

    it.each(OTHER_CLASSES)("status %i keeps %o", async (status, cls, name) => {
        const err = await client(status, "fixture_code").client.balance.retrieve().catch((e: unknown) => e);
        expect(err).toBeInstanceOf(cls);
        expect(err).toBeInstanceOf(DevupAPIError);
        expect((err as DevupAPIError).name).toBe(name);
        for (const [, newCls] of NEW_CLASSES) expect(err).not.toBeInstanceOf(newCls);
    });

    it("a 415 on a billed call is returned after one attempt, also with retries on", async () => {
        const mock = mockFetch(() => errorResponse(415, "invalid_request_error", "Fixture message.", { "x-request-id": REQ_ID }));
        const api = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 2 });
        const err = await api.embeddings.create({ model: MODEL_A, input: "x" }).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(UnsupportedMediaTypeError);
        expect(mock.calls).toHaveLength(1);
    });

    it("an unmapped status stays a plain DevupAPIError", () => {
        for (const status of [405, 410, 418]) {
            const e = makeAPIError(status, "m", undefined, undefined);
            expect(e.constructor).toBe(DevupAPIError);
            expect(e.name).toBe("DevupAPIError");
        }
    });
});
