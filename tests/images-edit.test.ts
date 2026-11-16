// images.edit() posts to /images/edits, as JSON when every input image is a URL or data URI,
// as multipart/form-data when at least one input is a file. The form follows the params object.
import { describe, expect, it } from "vitest";
import DevupAI, { type ImageEditJsonParams, type ImageEditParams, type ImageGenerateResponse } from "../src/index";
import { BASE, MODEL_A, REQ_ID, TEST_KEY, jsonResponse, mockFetch, type Handler, type RecordedRequest } from "./helpers/mock-fetch";

const RESULT: ImageGenerateResponse = {
    created: 1700000000,
    data: [{ url: `${BASE}/images/proxy?d=a&s=b` }],
    _devup: { cost_dzd: 1, balance_dzd: 99, request_id: REQ_ID },
};

const PNG_URL = "https://example.com/a.png";
const PNG_DATA_URI = "data:image/png;base64,AA==";

function setup(handler: Handler = () => jsonResponse(RESULT)) {
    const mock = mockFetch(handler);
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0 });
    return { mock, client };
}

function expectEditsRequest(req: RecordedRequest): void {
    expect(req.url).toBe(`${BASE}/images/edits`);
    expect(req.method).toBe("POST");
    expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
}

async function partText(part: FormDataEntryValue | null): Promise<string> {
    if (part === null) throw new Error("part missing");
    return typeof part === "string" ? part : part.text();
}

describe("images.edit(): multipart form (a file among the inputs)", () => {
    it("posts a FormData to /images/edits with the Bearer key; the Content-Type is left to the runtime", async () => {
        const { client, mock } = setup();
        await client.images.edit({ model: MODEL_A, prompt: "Add a hat", image: new Blob(["img"]) });
        const req = mock.last();
        expectEditsRequest(req);
        expect(req.form).toBeInstanceOf(FormData);
        expect(req.text).toBeNull();
        expect(req.headers.has("content-type")).toBe(false);
        expect(req.form!.get("image")).toBeInstanceOf(Blob);
        expect(await partText(req.form!.get("image"))).toBe("img");
        expect(req.form!.get("model")).toBe(MODEL_A);
        expect(req.form!.get("prompt")).toBe("Add a hat");
    });

    it("every typed field reaches the form: scalars as text, mask and markup as file parts", async () => {
        const { client, mock } = setup();
        const params: ImageEditParams = {
            model: MODEL_A,
            prompt: "Add a hat",
            image: new Blob(["img"]),
            mask: new Blob(["mask"]),
            markup: new Uint8Array([1, 2, 3]),
            n: 2,
            size: "1024x1024",
            response_format: "b64_json",
            width: 1024,
            height: 768,
            quality: "high",
            complexity: "low",
            background: "transparent",
            output_format: "png",
            output_compression: 80,
            num_inference_steps: 20,
            guidance_scale: 7.5,
            seed: 42,
            negative_prompt: "blur",
            aspect_ratio: "4:3",
        };
        await client.images.edit(params);
        const form = mock.last().form!;
        expect(form).toBeInstanceOf(FormData);
        const texts: Record<string, string> = {
            model: MODEL_A,
            prompt: "Add a hat",
            n: "2",
            size: "1024x1024",
            response_format: "b64_json",
            width: "1024",
            height: "768",
            quality: "high",
            complexity: "low",
            background: "transparent",
            output_format: "png",
            output_compression: "80",
            num_inference_steps: "20",
            guidance_scale: "7.5",
            seed: "42",
            negative_prompt: "blur",
            aspect_ratio: "4:3",
        };
        for (const [name, value] of Object.entries(texts)) {
            expect(form.getAll(name), name).toEqual([value]);
        }
        expect(form.get("mask")).toBeInstanceOf(Blob);
        expect(await partText(form.get("mask"))).toBe("mask");
        expect(form.get("markup")).toBeInstanceOf(Blob);
        expect(new Uint8Array(await (form.get("markup") as Blob).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
        // No part the params did not carry.
        const names = new Set<string>();
        form.forEach((_value, key) => names.add(key));
        expect([...names].sort()).toEqual([...Object.keys(texts), "image", "mask", "markup"].sort());
    });

    it("markup given as text is a text part", async () => {
        const { client, mock } = setup();
        await client.images.edit({ model: MODEL_A, prompt: "p", image: new Blob(["img"]), markup: "https://example.com/marks.png" });
        const form = mock.last().form!;
        expect(form.getAll("markup")).toEqual(["https://example.com/marks.png"]);
        expect(form.has("mask")).toBe(false);
    });

    it("several images give one `image` part each, in order", async () => {
        const { client, mock } = setup();
        await client.images.edit({ model: MODEL_A, prompt: "p", image: [new Blob(["first"]), new Blob(["second"])] });
        const form = mock.last().form!;
        const parts = form.getAll("image");
        expect(parts).toHaveLength(2);
        expect(parts[0]).toBeInstanceOf(Blob);
        expect(parts[1]).toBeInstanceOf(Blob);
        expect(await Promise.all(parts.map(partText))).toEqual(["first", "second"]);
    });

    it("a file among text images sends multipart; the text images are text parts, `{ image_url }` its string", async () => {
        const { client, mock } = setup();
        // `{ image_url }` is typed for the JSON form only; the runtime rule still maps it to its string.
        const params = { model: MODEL_A, prompt: "p", image: [new Blob(["file"]), PNG_URL, { image_url: PNG_DATA_URI }] } as unknown as ImageEditParams;
        await client.images.edit(params);
        const req = mock.last();
        expectEditsRequest(req);
        expect(req.form).toBeInstanceOf(FormData);
        const parts = req.form!.getAll("image");
        expect(parts).toHaveLength(3);
        expect(parts[0]).toBeInstanceOf(Blob);
        expect(parts[1]).toBe(PNG_URL);
        expect(parts[2]).toBe(PNG_DATA_URI);
    });

    it("request options inside params are not form parts", async () => {
        const { client, mock } = setup();
        await client.images.edit({ model: MODEL_A, prompt: "p", image: new Blob(["img"]), timeout: 5_000 });
        const form = mock.last().form!;
        expect(form.has("timeout")).toBe(false);
        const names: string[] = [];
        form.forEach((_value, key) => names.push(key));
        expect(names.sort()).toEqual(["image", "model", "prompt"]);
    });
});

describe("images.edit(): JSON form (every input a URL or data URI)", () => {
    it("`images` as strings and `{ image_url }` objects: the params are sent as JSON, byte for byte", async () => {
        const { client, mock } = setup();
        const params: ImageEditJsonParams = {
            model: MODEL_A,
            prompt: "Replace the sky",
            images: [PNG_URL, { image_url: PNG_DATA_URI }],
            mask: { image_url: PNG_DATA_URI },
            size: "1024x1024",
            n: 1,
            response_format: "b64_json",
        };
        await client.images.edit(params);
        const req = mock.last();
        expectEditsRequest(req);
        expect(req.form).toBeNull();
        expect(req.headers.get("content-type")).toBe("application/json");
        expect(req.text).toBe(JSON.stringify(params));
    });

    it("`image` as one string", async () => {
        const { client, mock } = setup();
        const params: ImageEditJsonParams = { model: MODEL_A, prompt: "p", image: PNG_URL, markup: "https://example.com/marks.png" };
        await client.images.edit(params);
        const req = mock.last();
        expectEditsRequest(req);
        expect(req.headers.get("content-type")).toBe("application/json");
        expect(req.json).toEqual(params);
    });

    it("request options inside params are not sent in the JSON body", async () => {
        const { client, mock } = setup();
        await client.images.edit({ model: MODEL_A, prompt: "p", images: [PNG_URL], timeout: 5_000 });
        const req = mock.last();
        expect(req.text).toBe(JSON.stringify({ model: MODEL_A, prompt: "p", images: [PNG_URL] }));
    });
});

describe("images.edit(): response", () => {
    it("resolves to the parsed ImageGenerateResponse in both forms", async () => {
        const { client } = setup();
        const fromForm = await client.images.edit({ model: MODEL_A, prompt: "p", image: new Blob(["img"]) });
        expect(fromForm.data[0]!.url).toBe(RESULT.data[0]!.url);
        expect(fromForm._devup?.request_id).toBe(REQ_ID);
        const fromJson = await client.images.edit({ model: MODEL_A, prompt: "p", images: [PNG_URL] });
        expect(fromJson).toStrictEqual(RESULT);
    });
});
