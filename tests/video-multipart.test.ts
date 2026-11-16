// video.generations.create() sends JSON when every media input is text, and multipart form data when any is a file.
import { describe, expect, it } from "vitest";
import DevupAI from "../src/index";
import { BASE, MODEL_A, TEST_KEY, jsonResponse, mockFetch, type Handler } from "./helpers/mock-fetch";

function setup(handler: Handler) {
    const mock = mockFetch(handler);
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0 });
    return { mock, client };
}

const VIDEO = { created: 1700000000, data: [{ url: "https://example.com/v.mp4" }], _devup: { cost_dzd: 1, balance_dzd: 2 } };
const png = (): Blob => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
const wav = (): Blob => new Blob([new Uint8Array([82, 73, 70, 70])], { type: "audio/wav" });

describe("video.generations.create: JSON form", () => {
    it("the JSON body is unchanged byte for byte, with request options inside params", async () => {
        const { client, mock } = setup(() => jsonResponse(VIDEO));
        await client.video.generations.create({
            model: MODEL_A,
            prompt: "A sunrise",
            duration: 8,
            generate_audio: true,
            image: "https://example.com/first.png",
            reference_images: [{ url: "https://example.com/r.png" }],
            timeout: 5000,
            headers: { "X-Fixture": "1" },
        });
        const req = mock.last();
        expect(req.method).toBe("POST");
        expect(req.url).toBe(`${BASE}/video/generations`);
        expect(req.headers.get("content-type")).toBe("application/json");
        expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
        expect(req.headers.get("x-fixture")).toBe("1");
        // Captured from the JSON-only implementation: the exact string it sent for these params.
        expect(req.text).toBe(
            '{"model":"fixture/model-a","prompt":"A sunrise","duration":8,"generate_audio":true,"image":"https://example.com/first.png","reference_images":[{"url":"https://example.com/r.png"}]}',
        );
        expect(req.form).toBeNull();
    });

    it("strings only for image and reference_images stay JSON, arrays preserved", async () => {
        const { client, mock } = setup(() => jsonResponse(VIDEO));
        await client.video.generations.create({
            model: MODEL_A,
            prompt: "A sunrise",
            image: "https://example.com/first.png",
            reference_images: ["https://example.com/r1.png", "data:image/png;base64,AAAA"],
            reference_audios: "https://example.com/a.wav",
        });
        const req = mock.last();
        expect(req.form).toBeNull();
        expect(req.headers.get("content-type")).toBe("application/json");
        expect(req.json).toEqual({
            model: MODEL_A,
            prompt: "A sunrise",
            image: "https://example.com/first.png",
            reference_images: ["https://example.com/r1.png", "data:image/png;base64,AAAA"],
            reference_audios: "https://example.com/a.wav",
        });
    });

    it("request options inside params are stripped from the JSON body; the second argument wins", async () => {
        const { client, mock } = setup(() => jsonResponse(VIDEO));
        await client.video.generations.create(
            { model: MODEL_A, prompt: "p", timeout: 5000, headers: { "X-Fixture": "params" } },
            { headers: { "X-Fixture": "second" } },
        );
        const req = mock.last();
        expect(req.json).toEqual({ model: MODEL_A, prompt: "p" });
        expect(Object.keys(req.json as object)).not.toContain("timeout");
        expect(req.headers.get("x-fixture")).toBe("second");
    });
});

describe("video.generations.create: multipart form", () => {
    it("a Blob image sends FormData with scalars as text", async () => {
        const { client, mock } = setup(() => jsonResponse(VIDEO));
        const result = await client.video.generations.create({
            model: MODEL_A,
            prompt: "A sunrise",
            image: png(),
            duration: 8,
            generate_audio: true,
            response_format: "url",
        });
        const req = mock.last();
        expect(req.method).toBe("POST");
        expect(req.url).toBe(`${BASE}/video/generations`);
        expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
        // The runtime sets the multipart boundary itself: the SDK sets no Content-Type.
        expect(req.headers.get("content-type")).toBeNull();
        expect(req.form).toBeInstanceOf(FormData);
        const form = req.form!;
        expect(form.get("model")).toBe(MODEL_A);
        expect(form.get("prompt")).toBe("A sunrise");
        expect(form.get("image")).toBeInstanceOf(Blob);
        expect(form.get("duration")).toBe("8");
        expect(form.get("generate_audio")).toBe("true");
        expect(form.get("response_format")).toBe("url");
        expect(result).toEqual(VIDEO);
    });

    it("a Uint8Array image is sent as a file part", async () => {
        const { client, mock } = setup(() => jsonResponse(VIDEO));
        await client.video.generations.create({ model: MODEL_A, prompt: "p", image: new Uint8Array([1, 2, 3]) });
        const part = mock.last().form!.get("image");
        expect(part).toBeInstanceOf(Blob);
        expect((part as Blob).size).toBe(3);
    });

    it("reference fields: one part per item under the plain field name, files then text", async () => {
        const { client, mock } = setup(() => jsonResponse(VIDEO));
        await client.video.generations.create({
            model: MODEL_A,
            prompt: "p",
            reference_images: [png(), "https://example.com/r.png"],
            reference_audios: wav(),
        });
        const form = mock.last().form!;
        const images = form.getAll("reference_images");
        expect(images).toHaveLength(2);
        expect(images[0]).toBeInstanceOf(Blob);
        expect(images[1]).toBe("https://example.com/r.png");
        const audios = form.getAll("reference_audios");
        expect(audios).toHaveLength(1);
        expect(audios[0]).toBeInstanceOf(Blob);
        expect(form.getAll("reference_images[]")).toEqual([]);
        expect(form.getAll("reference_audios[]")).toEqual([]);
        expect(form.has("reference_videos")).toBe(false);
    });

    it("a text reference next to a file reference in another field is a text part", async () => {
        const { client, mock } = setup(() => jsonResponse(VIDEO));
        await client.video.generations.create({
            model: MODEL_A,
            prompt: "p",
            reference_images: "https://example.com/r.png",
            reference_videos: [new Blob([new Uint8Array([0, 0, 0, 24])], { type: "video/mp4" })],
        });
        const form = mock.last().form!;
        expect(form.getAll("reference_images")).toEqual(["https://example.com/r.png"]);
        expect(form.getAll("reference_videos")).toHaveLength(1);
        expect(form.getAll("reference_videos")[0]).toBeInstanceOf(Blob);
    });

    it("last_frame_image as a Blob, image as text", async () => {
        const { client, mock } = setup(() => jsonResponse(VIDEO));
        await client.video.generations.create({
            model: MODEL_A,
            prompt: "p",
            image: "https://example.com/first.png",
            last_frame_image: png(),
        });
        const form = mock.last().form!;
        expect(form.get("image")).toBe("https://example.com/first.png");
        expect(form.get("last_frame_image")).toBeInstanceOf(Blob);
    });

    it("request options inside params are not form parts; undefined fields are left out", async () => {
        const { client, mock } = setup(() => jsonResponse(VIDEO));
        await client.video.generations.create(
            { model: MODEL_A, prompt: "p", image: png(), seed: undefined, timeout: 5000, headers: { "X-Fixture": "params" } },
            { headers: { "X-Fixture": "second" } },
        );
        const req = mock.last();
        const form = req.form!;
        expect(form.has("timeout")).toBe(false);
        expect(form.has("headers")).toBe(false);
        expect(form.has("seed")).toBe(false);
        expect(req.headers.get("x-fixture")).toBe("second");
        const names: string[] = [];
        form.forEach((_value, name) => names.push(name));
        expect(names.sort()).toEqual(["image", "model", "prompt"]);
    });
});
