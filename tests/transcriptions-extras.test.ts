// The extra transcription fields (`prompt`, `temperature`, `timestamp_granularities`) as form parts.
import { describe, expect, it } from "vitest";
import DevupAI from "../src/index";
import { BASE, MODEL_A, TEST_KEY, jsonResponse, mockFetch, type Handler } from "./helpers/mock-fetch";

function setup(handler: Handler) {
    const mock = mockFetch(handler);
    const client = new DevupAI({ apiKey: TEST_KEY, fetch: mock.fetch, maxRetries: 0 });
    return { mock, client };
}

const FILE = new Uint8Array([1, 2, 3]);

/** Names of every part of a form, in order (repeated names repeated). */
function partNames(form: FormData): string[] {
    const names: string[] = [];
    form.forEach((_value, key) => names.push(key));
    return names;
}

describe("transcriptions extras", () => {
    it("sends prompt, temperature and one timestamp_granularities[] part per value", async () => {
        const { client, mock } = setup(() => jsonResponse({ text: "x", _devup: { cost_dzd: 1, balance_dzd: 2 } }));
        await client.audio.transcriptions.create({
            file: FILE,
            model: MODEL_A,
            language: "en",
            prompt: "Fixture, Name",
            temperature: 0.2,
            timestamp_granularities: ["word", "segment"],
            response_format: "verbose_json",
        });
        const req = mock.last();
        expect(req.url).toBe(`${BASE}/audio/transcriptions`);
        const form = req.form!;
        expect(form).toBeInstanceOf(FormData);
        // Existing parts, unchanged.
        expect(form.get("file")).toBeInstanceOf(Blob);
        expect(form.get("model")).toBe(MODEL_A);
        expect(form.get("language")).toBe("en");
        expect(form.get("response_format")).toBe("verbose_json");
        // New parts.
        expect(form.get("prompt")).toBe("Fixture, Name");
        expect(form.get("temperature")).toBe("0.2");
        expect(form.getAll("timestamp_granularities[]")).toEqual(["word", "segment"]);
        expect(form.get("timestamp_granularities")).toBeNull();
        expect(partNames(form).sort()).toEqual(
            ["file", "language", "model", "prompt", "response_format", "temperature", "timestamp_granularities[]", "timestamp_granularities[]"].sort(),
        );
    });

    it("temperature 0 is sent as \"0\"", async () => {
        const { client, mock } = setup(() => jsonResponse({ text: "x", _devup: { cost_dzd: 1, balance_dzd: 2 } }));
        await client.audio.transcriptions.create({ file: FILE, model: MODEL_A, temperature: 0 });
        expect(mock.last().form!.get("temperature")).toBe("0");
    });

    it("one timestamp granularity gives one timestamp_granularities[] part", async () => {
        const { client, mock } = setup(() => jsonResponse({ text: "x", _devup: { cost_dzd: 1, balance_dzd: 2 } }));
        await client.audio.transcriptions.create({ file: FILE, model: MODEL_A, timestamp_granularities: ["segment"], response_format: "verbose_json" });
        expect(mock.last().form!.getAll("timestamp_granularities[]")).toEqual(["segment"]);
    });

    it("omitted extras produce no parts; the existing parts are exactly file, model, language, response_format", async () => {
        const { client, mock } = setup(() => jsonResponse({ text: "x", _devup: { cost_dzd: 1, balance_dzd: 2 } }));
        await client.audio.transcriptions.create({ file: FILE, model: MODEL_A, language: "en", response_format: "json" });
        const form = mock.last().form!;
        expect(form.has("prompt")).toBe(false);
        expect(form.has("temperature")).toBe(false);
        expect(form.has("timestamp_granularities[]")).toBe(false);
        expect(form.has("timestamp_granularities")).toBe(false);
        expect(partNames(form)).toEqual(["file", "model", "language", "response_format"]);
    });

    it("an empty timestamp_granularities array produces no part", async () => {
        const { client, mock } = setup(() => jsonResponse({ text: "x", _devup: { cost_dzd: 1, balance_dzd: 2 } }));
        await client.audio.transcriptions.create({ file: FILE, model: MODEL_A, timestamp_granularities: [] });
        const form = mock.last().form!;
        expect(form.has("timestamp_granularities[]")).toBe(false);
        expect(partNames(form)).toEqual(["file", "model"]);
    });

    it("request options mixed into params are not sent as parts", async () => {
        const { client, mock } = setup(() => jsonResponse({ text: "x", _devup: { cost_dzd: 1, balance_dzd: 2 } }));
        await client.audio.transcriptions.create({ file: FILE, model: MODEL_A, prompt: "p", timeout: 5_000, headers: { "X-Fixture": "1" } });
        const req = mock.last();
        expect(req.headers.get("x-fixture")).toBe("1");
        expect(partNames(req.form!)).toEqual(["file", "model", "prompt"]);
    });
});
