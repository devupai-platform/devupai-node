// A model's own image options and `image_params`: the request types keep their named fields
// (model required, size / n / mask typed) while taking options of the model's own, and the
// options reach the API as the spec describes (JSON values in JSON, one text field per option
// in multipart, a structured value as one field with its JSON text).
// Type checks run with `tsc --noEmit -p tsconfig.test.json` (lines marked @ts-expect-error must NOT compile).
import { describe, expect, expectTypeOf, it } from "vitest";
import DevupAI, {
    type APIPromise,
    type ImageEditInput,
    type ImageEditJsonParams,
    type ImageEditParams,
    type ImageGenerateParams,
    type ImageGenerateResponse,
    type ImageInputUrl,
    type ImageParams,
    type ImageParamsInputs,
    type ImageParamsOption,
    type ModelObject,
} from "../src/index";
import { BASE, MODEL_A, REQ_ID, TEST_KEY, jsonResponse, mockFetch, type Handler } from "./helpers/mock-fetch";

const RESULT: ImageGenerateResponse = {
    created: 1700000000,
    data: [{ url: `${BASE}/images/proxy?d=a&s=b` }],
    _devup: { cost_dzd: 1, balance_dzd: 99, request_id: REQ_ID },
};

const REGIONS = [
    [0, 0, 64, 64],
    [10, 10, 32, 32],
];

function setup(handler: Handler = () => jsonResponse(RESULT)) {
    const mock = mockFetch(handler);
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0 });
    return { mock, client };
}

/** Compile-only: never called. */
function typeChecks(client: DevupAI, blob: Blob): void {
    // D1: the multipart edit params keep `model` as a required string and the named fields typed.
    expectTypeOf<ImageEditParams["model"]>().toEqualTypeOf<string>();
    expectTypeOf<ImageEditParams["prompt"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ImageEditParams["size"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ImageEditParams["n"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ImageEditParams["response_format"]>().toEqualTypeOf<"url" | "b64_json" | undefined>();
    expectTypeOf<ImageEditParams["mask"]>().toEqualTypeOf<ImageEditInput | undefined>();
    expectTypeOf<ImageEditParams["markup"]>().toEqualTypeOf<ImageEditInput | undefined>();
    expectTypeOf<ImageEditParams["image"]>().toEqualTypeOf<ImageEditInput | ImageEditInput[] | undefined>();
    // An option of the model's own is taken, with an `unknown` value type.
    expectTypeOf<ImageEditParams["regions"]>().toEqualTypeOf<unknown>();
    const ownOptions: ImageEditParams = { model: MODEL_A, image: blob, prompt_extend: true, regions: REGIONS, style: "flat" };
    void ownOptions;
    // @ts-expect-error model is required
    const noModel: ImageEditParams = { prompt: "x", image: blob };
    // @ts-expect-error n is a number
    const nText: ImageEditParams = { model: MODEL_A, n: "2" };
    // @ts-expect-error size is a string
    const sizeNumber: ImageEditParams = { model: MODEL_A, size: 1024 };
    // @ts-expect-error a number is not an image
    const maskNumber: ImageEditParams = { model: MODEL_A, mask: 5 };
    // @ts-expect-error a number is not an image
    const imageNumber: ImageEditParams = { model: MODEL_A, image: 5 };
    // @ts-expect-error response_format takes url or b64_json only
    const badFormat: ImageEditParams = { model: MODEL_A, response_format: "png" };
    void [noModel, nText, sizeNumber, maskNumber, imageNumber, badFormat];

    // The same on the generation params and the JSON edit params.
    expectTypeOf<ImageGenerateParams["model"]>().toEqualTypeOf<string>();
    expectTypeOf<ImageGenerateParams["n"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ImageEditJsonParams["model"]>().toEqualTypeOf<string>();
    expectTypeOf<ImageEditJsonParams["mask"]>().toEqualTypeOf<string | ImageInputUrl | undefined>();
    const genOwn: ImageGenerateParams = { model: MODEL_A, prompt: "x", prompt_extend: true, regions: REGIONS };
    const editJsonOwn: ImageEditJsonParams = { model: MODEL_A, images: ["https://example.com/a.png"], regions: REGIONS, enhance: false };
    void [genOwn, editJsonOwn];
    // @ts-expect-error model is required
    const genNoModel: ImageGenerateParams = { prompt: "x" };
    // @ts-expect-error n is a number
    const genNText: ImageGenerateParams = { model: MODEL_A, n: "2" };
    // @ts-expect-error a number is not an image
    const editJsonMask: ImageEditJsonParams = { model: MODEL_A, mask: 5 };
    void [genNoModel, genNText, editJsonMask];

    // D2: the methods take a model's own options and structured values, with their usual result type.
    expectTypeOf(
        client.images.generate({ model: MODEL_A, prompt: "x", prompt_extend: true, regions: REGIONS }),
    ).toEqualTypeOf<APIPromise<ImageGenerateResponse>>();
    expectTypeOf(
        client.images.edit({ model: MODEL_A, image: blob, prompt: "x", prompt_extend: true, regions: REGIONS }),
    ).toEqualTypeOf<APIPromise<ImageGenerateResponse>>();
    expectTypeOf(
        client.images.edit({ model: MODEL_A, images: ["https://example.com/a.png"], regions: REGIONS, enhance: false }),
    ).toEqualTypeOf<APIPromise<ImageGenerateResponse>>();
    // @ts-expect-error model is required on an edit
    void client.images.edit({ prompt: "x", image: blob });
    // @ts-expect-error n is a number on an edit
    void client.images.edit({ model: MODEL_A, image: blob, n: "2" });

    // D3: image_params on the model object, and its exported types.
    expectTypeOf<ModelObject["image_params"]>().toEqualTypeOf<ImageParams | undefined>();
    expectTypeOf<ImageParams["options"]>().toEqualTypeOf<ImageParamsOption[]>();
    expectTypeOf<ImageParams["inputs"]>().toEqualTypeOf<ImageParamsInputs | undefined>();
    expectTypeOf<ImageParams["endpoints"]>().toEqualTypeOf<Array<"generations" | "edits">>();
    expectTypeOf<ImageParams["prompt"]>().toEqualTypeOf<"none" | "optional" | undefined>();
    expectTypeOf<ImageParamsOption["field"]>().toEqualTypeOf<string>();
    expectTypeOf<ImageParamsOption["kind"]>().toEqualTypeOf<
        "boolean" | "choice" | "int" | "decimal" | "text" | "structured" | undefined
    >();
    expectTypeOf<ImageParamsInputs["mask_format"]>().toEqualTypeOf<"alpha" | "black_and_white" | undefined>();
    expectTypeOf<ImageParamsInputs["mask_required"]>().toEqualTypeOf<true | undefined>();
    expectTypeOf<NonNullable<ImageParamsInputs["image"]>["roles"]>().toEqualTypeOf<Array<"source" | "reference"> | undefined>();
    expectTypeOf(client.models.retrieve(MODEL_A)).toEqualTypeOf<APIPromise<ModelObject>>();
}

const MODEL_WITH_OPTIONS = {
    id: MODEL_A,
    object: "model",
    owned_by: "fixture",
    image_params: {
        endpoints: ["generations", "edits"],
        options: [
            { field: "size", values: ["1024x1024"], default: "1024x1024" },
            { field: "prompt_extend", kind: "boolean", default: true },
            { field: "regions", kind: "structured", endpoints: ["edits"], schema: { type: "array" }, length_matches: "input_images" },
        ],
        inputs: { image: { min: 1, max: 2, roles: ["source", "reference"] }, mask: true, mask_format: "black_and_white" },
        prompt: "optional",
        prompt_max_length: 2000,
    },
};

describe("image_params on the model object", () => {
    it("models.retrieve() gives image_params as the API sends it, readable through the exported types", async () => {
        const { client } = setup(() => jsonResponse(MODEL_WITH_OPTIONS));
        const model = await client.models.retrieve(MODEL_A);
        const params: ImageParams | undefined = model.image_params;
        expect(params).toEqual(MODEL_WITH_OPTIONS.image_params);
        const inputs: ImageParamsInputs | undefined = params?.inputs;
        expect(inputs?.mask_format).toBe("black_and_white");
        expect(inputs?.image?.roles).toEqual(["source", "reference"]);
        const structured: ImageParamsOption | undefined = params?.options.find((o) => o.kind === "structured");
        expect(structured?.field).toBe("regions");
        expect(structured?.length_matches).toBe("input_images");
    });
});

describe("a model's own options on the wire", () => {
    it("images.generate() sends own options and structured values as JSON values, exactly as given", async () => {
        const { client, mock } = setup();
        await client.images.generate({ model: MODEL_A, prompt: "A red bicycle", prompt_extend: false, steps_profile: "fast", strength: 0.5, regions: REGIONS });
        const req = mock.last();
        expect(req.url).toBe(`${BASE}/images/generations`);
        expect(req.headers.get("content-type")).toBe("application/json");
        expect(req.json).toEqual({ model: MODEL_A, prompt: "A red bicycle", prompt_extend: false, steps_profile: "fast", strength: 0.5, regions: REGIONS });
    });

    it("images.edit() as JSON (URL inputs) sends a structured value as a JSON value", async () => {
        const { client, mock } = setup();
        await client.images.edit({
            model: MODEL_A,
            prompt: "Blend",
            images: ["https://example.com/a.png", { image_url: "https://example.com/b.png" }],
            regions: REGIONS,
            enhance: true,
        });
        const req = mock.last();
        expect(req.url).toBe(`${BASE}/images/edits`);
        expect(req.form).toBeNull();
        expect(req.json).toEqual({
            model: MODEL_A,
            prompt: "Blend",
            images: ["https://example.com/a.png", { image_url: "https://example.com/b.png" }],
            regions: REGIONS,
            enhance: true,
        });
    });

    it("images.edit() as multipart sends a structured value once, as one field with its JSON text; switches as true/false", async () => {
        const { client, mock } = setup();
        await client.images.edit({
            model: MODEL_A,
            prompt: "Blend",
            image: [new Blob(["a"]), new Blob(["b"])],
            mask: new Blob(["m"]),
            regions: REGIONS,
            settings: { detail: "high", passes: 2 },
            prompt_extend: true,
            enhance: false,
            strength: 0.75,
            n: 2,
            style: "2MP",
        });
        const form = mock.last().form;
        expect(form).toBeInstanceOf(FormData);
        if (!form) throw new Error("form missing");
        expect(form.getAll("regions")).toEqual([JSON.stringify(REGIONS)]);
        expect(JSON.parse(form.get("regions") as string)).toEqual(REGIONS);
        expect(form.getAll("settings")).toEqual([JSON.stringify({ detail: "high", passes: 2 })]);
        expect(form.getAll("prompt_extend")).toEqual(["true"]);
        expect(form.getAll("enhance")).toEqual(["false"]);
        expect(form.getAll("strength")).toEqual(["0.75"]);
        expect(form.getAll("n")).toEqual(["2"]);
        expect(form.getAll("style")).toEqual(["2MP"]);
        expect(form.getAll("model")).toEqual([MODEL_A]);
        expect(form.getAll("image")).toHaveLength(2);
        expect(form.getAll("mask")).toHaveLength(1);
    });

    it("an own option left undefined or null is not sent in a multipart edit", async () => {
        const { client, mock } = setup();
        await client.images.edit({ model: MODEL_A, image: new Blob(["a"]), prompt_extend: undefined, regions: null });
        const form = mock.last().form;
        if (!form) throw new Error("form missing");
        expect(form.has("prompt_extend")).toBe(false);
        expect(form.has("regions")).toBe(false);
    });
});

describe("compile-only checks", () => {
    it("are part of this file", () => {
        expect(typeof typeChecks).toBe("function");
    });
});
