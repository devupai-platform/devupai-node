// D2 (vendored spec + generated types in sync), D10 (no literal version in src), D13/D16 (public text checks).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(__dirname, "..");
const PKG_VERSION: string = (JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { version: string }).version;

function listFiles(dir: string, ext: RegExp): string[] {
    if (!existsSync(dir)) return [];
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) out.push(...listFiles(full, ext));
        else if (ext.test(name)) out.push(full);
    }
    return out;
}

const rel = (file: string): string => path.relative(ROOT, file).split(path.sep).join("/");

describe("vendored spec and generated types (D2, block0 §3.9 item 13)", () => {
    it("openapi/SPEC_SHA256 is the sha256 of openapi/devupai-v1.yaml", () => {
        const bytes = readFileSync(path.join(ROOT, "openapi", "devupai-v1.yaml"));
        const recorded = readFileSync(path.join(ROOT, "openapi", "SPEC_SHA256"), "utf8");
        expect(recorded).toMatch(/^[0-9a-f]{64}\n$/);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(recorded.trim());
    });

    it("npm run check:types passes (hash and regenerated schema match)", () => {
        const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "check-types.mjs")], { cwd: ROOT, encoding: "utf8", shell: false });
        expect(result.stderr).toBe("");
        expect(result.status).toBe(0);
    }, 60_000);

    it("check:types fails with an actionable message when the recorded hash differs", () => {
        const dir = mkdtempSync(path.join(os.tmpdir(), "devupai-check-types-"));
        try {
            const badHash = path.join(dir, "SPEC_SHA256");
            writeFileSync(badHash, `${"0".repeat(64)}\n`);
            const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "check-types.mjs"), "--hash", badHash], {
                cwd: ROOT,
                encoding: "utf8",
                shell: false,
            });
            expect(result.status).toBe(1);
            expect(result.stderr).toMatch(/sync:spec|generate:types/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 60_000);
});

describe("version (D10)", () => {
    it("src/ contains no literal copy of the package version", () => {
        const hits = listFiles(path.join(ROOT, "src"), /\.ts$/).filter((f) => {
            const text = readFileSync(f, "utf8");
            return text.includes(`"${PKG_VERSION}"`) || text.includes(`'${PKG_VERSION}'`) || text.includes(`devupai-node/${PKG_VERSION}`);
        });
        expect(hits.map(rel)).toEqual([]);
    });
});

/**
 * sha256 (first 16 hex chars) of lower-cased terms that must not appear in public text.
 * Hashes, so that this public file does not itself list the terms.
 */
const FORBIDDEN_TERM_HASHES = new Set([
    // Wording rules of the SDK documentation and the error codes that are not public (D16).
    "4ea5ee68fea05586",
    "a74e503354fdd464",
    "1581e27de87bffae",
    "7b76de4c4c1b0103",
    "ed2db96c7d99f13e",
    "bcd475104a873a42",
    "5c7ee2074b65853f",
    "dbf880608a5fe7ae",
    "fc6672ade6fd208a",
    "88fc4d7bf12e0d73",
    "7b9fde2dd505251b",
    "6b86ac84384ccbf2",
    "0163dad86bcbf722",
    "09c27ea4804eaf5d",
    "fa324adb1d7b75dc",
    "0f0942ba21c6b8c4",
    // The D16 review word list, with inflections (comments avoid the words themselves).
    // Keeping stored copies of responses: 4 forms.
    "5e1ecee06a7fc06f",
    "efbe9d5743db5752",
    "3673014e72b67383",
    "6fe78deb222783bc",
    // Setting funds aside before a request: 4 forms.
    "e8b22d83b417e85b",
    "3b97260d76d3d7df",
    "c20dea4d876b5b8f",
    "e77b141e2388d56c",
    // Finalizing a charge: 5 forms (incl. the noun).
    "6868e83de35c465d",
    "36809acb6fbb9c3e",
    "d31e014808ecdd2a",
    "0a0dcac5952689a5",
    "a75c433ab2ae1daf",
    // Choosing where a request goes: 4 more forms (the -ing form is in the list above).
    "8a84e406c08ac959",
    "e22bc966d9352957",
    "a45814b02024a5fa",
    "74c95604043427f0",
    // Conditional code paths: 3 forms.
    "f38c764c8aa00b65",
    "dce1905351040e79",
    "0b007b691d007943",
    // The service behind a model: 2 forms.
    "5c4c1964340aca5b",
    "1e19bab29bc6432a",
    // Forwarding (the 3.x name of images.download): 4 forms.
    "1241936d4dd3aad6",
    "a04c3b825fab3627",
    "b09f17ea1b5ca77b",
    "ea2fae23d900274b",
]);

/** A legitimate use of a listed word: a literal text removed from a line before its words are checked. */
interface AllowedText {
    text: string;
    /**
     * Limits the entry to these files: a path (relative to the package root, `/` separators)
     * or a pattern. Without it, the entry applies everywhere.
     */
    files?: ReadonlyArray<string | RegExp>;
    why: string;
}

const SCHEMA_FILE = ["src/internal/openapi-schema.ts"];
const AI_ENTRY_FILE = ["src/provider.ts"];

/**
 * The exception list. Matching is by whole word (see `words`), so longer words that only
 * contain a listed word, such as "placeholders" or "cached_tokens", are never hits and
 * need no entry. This file names every entry, so every entry applies to it.
 */
const ALLOWED_TEXT: AllowedText[] = [
    // URLs and names that are part of the public API.
    { text: "/images/proxy", why: "URL path of the generated-file endpoint; D18 keeps it in URL literals" },
    { text: "proxyImage", files: SCHEMA_FILE, why: "operation id of that endpoint in the vendored spec" },
    { text: "images.proxy", files: ["tests/types.test.ts", "MIGRATION_V3_TO_V4.md", "CHANGELOG.md", /^docs\/v3\/[^/]+\.md$/], why: "the 3.x method name: migration notes, 3.x history, and the type test that checks it is gone (D18)" },
    { text: '"proxy" in client.images', files: ["tests/resources.test.ts"], why: "the runtime check that the 3.x method name is gone (D18)" },
    { text: "settlement:", why: "field name of the webhook payloads" },
    { text: ".settlement", why: "the same webhook field, read from an event" },
    { text: '"settled"', why: "a value of that webhook field" },
    { text: "cached?:", files: SCHEMA_FILE, why: "price field of a model for reused prompt tokens" },
    { text: "cached:", files: ["tests/contract.test.ts"], why: "the same price field, in a schema fixture" },
    { text: "cached input tokens", files: SCHEMA_FILE, why: "spec description of that price field" },
    { text: "served from cache", files: SCHEMA_FILE, why: "spec description of the OpenAI-compatible cached_tokens usage field" },
    { text: "Cache-Control", why: "HTTP header name" },
    // The Vercel AI SDK integration (devupai/ai): package, file and identifier names it must use.
    { text: "@ai-sdk/provider", why: "npm package of the AI SDK model interfaces, a peer dependency (also matches its -utils package)" },
    { text: "src/provider", why: "source file and import path of the devupai/ai entry point" },
    { text: "dist/provider.mjs", why: "build output of devupai/ai" },
    { text: "dist/provider.d.mts", why: "build output of devupai/ai" },
    { text: "ProviderV4", why: "AI SDK interface name" },
    { text: "OpenAICompatibleProvider", why: "AI SDK type name" },
    { text: "createProviderRegistry", why: "AI SDK function name" },
    { text: "providerOptions", why: "AI SDK call option" },
    { text: "get provider()", files: AI_ENTRY_FILE, why: "property required by the AI SDK image model interface" },
    { text: "this.model.provider", files: AI_ENTRY_FILE, why: "the same property, read from the wrapped model" },
    // CI.
    { text: "cache: npm", files: [".github/workflows/ci.yml"], why: "actions/setup-node option that keeps npm downloads between CI runs" },
];

const SELF = "tests/public-surface.test.ts";

function appliesTo(entry: AllowedText, file: string): boolean {
    if (file === SELF || !entry.files) return true;
    return entry.files.some((f) => (typeof f === "string" ? f === file : f.test(file)));
}

/** The listed words left in `line` of `file` once the allowed texts of that file are removed. */
function lineHits(file: string, line: string): string[] {
    let rest = line;
    for (const entry of ALLOWED_TEXT) {
        if (appliesTo(entry, file)) rest = rest.split(entry.text).join(" ");
    }
    return words(rest).filter((w) => FORBIDDEN_TERM_HASHES.has(termHash(w)));
}

function termHash(term: string): string {
    return createHash("sha256").update(term.toLowerCase()).digest("hex").slice(0, 16);
}

/** Words of a text: identifiers and hyphenated words, plus their hyphen and camelCase parts. */
function words(text: string): string[] {
    const out: string[] = [];
    for (const token of text.match(/[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*/g) ?? []) {
        out.push(token);
        for (const part of token.split("-")) {
            out.push(part);
            out.push(...part.split(/(?<=[a-z0-9])(?=[A-Z])/));
        }
    }
    return out;
}

function publicFiles(): string[] {
    const files = [
        ...listFiles(path.join(ROOT, "src"), /\.ts$/),
        ...listFiles(path.join(ROOT, "tests"), /\.ts$/),
        ...listFiles(path.join(ROOT, "scripts"), /\.(m?js|cjs)$/),
        ...listFiles(path.join(ROOT, "docs", "v3"), /\.md$/),
    ];
    for (const name of ["README.md", "CHANGELOG.md", "MIGRATION_V3_TO_V4.md", "package.json", path.join(".github", "workflows", "ci.yml")]) {
        const full = path.join(ROOT, name);
        if (existsSync(full)) files.push(full);
    }
    return files;
}

describe("public text (D16)", () => {
    it("the self-check hashes the way the list was built", () => {
        expect(termHash("Example")).toBe(termHash("example"));
        expect(words("fooBar baz-qux")).toEqual(expect.arrayContaining(["fooBar", "foo", "Bar", "baz-qux", "baz", "qux"]));
        expect(FORBIDDEN_TERM_HASHES.size).toBe(16 + 26);
    });

    it("the exception list removes only its own text, and whole-word matching skips longer words", () => {
        const unique = (list: string[]): string[] => [...new Set(list)];
        for (const entry of ALLOWED_TEXT) {
            // Each entry contains at least one listed word, so it is a real exception...
            const listed = unique(words(entry.text).filter((w) => FORBIDDEN_TERM_HASHES.has(termHash(w))));
            expect(listed, entry.text).not.toEqual([]);
            const file = entry.files?.find((f): f is string => typeof f === "string") ?? "README.md";
            // ...it removes itself in a file it applies to...
            expect(lineHits(file, `a ${entry.text} b`), entry.text).toEqual([]);
            // ...the same word outside the entry is still a hit...
            expect(unique(lineHits(file, `a ${entry.text} b ${listed[0]!} c`)), entry.text).toEqual([listed[0]]);
            // ...and a file-limited entry is not an exception anywhere else.
            if (entry.files) expect(lineHits("README.md", `a ${entry.text} b`), entry.text).not.toEqual([]);
        }
        for (const longer of ["placeholders", "cached_tokens"]) expect(lineHits("README.md", longer)).toEqual([]);
    });

    it("docs/v3 is part of the checked files", () => {
        const checked = publicFiles().map(rel);
        expect(checked.filter((f) => /^docs\/v3\/[^/]+\.md$/.test(f)).length).toBeGreaterThan(0);
        expect(checked).toContain(SELF);
    });

    it("no word of the D16 lists (wording rules and review words) and no non-public error code in src, tests, scripts, docs/v3, README, CHANGELOG, migration notes, package.json or CI, outside the commented exception list", () => {
        const hits: string[] = [];
        for (const file of publicFiles()) {
            const name = rel(file);
            const lines = readFileSync(file, "utf8").split(/\r?\n/);
            lines.forEach((line, i) => {
                const found = lineHits(name, line);
                if (found.length > 0) hits.push(`${name}:${i + 1} [${[...new Set(found)].join(", ")}]`);
            });
        }
        expect(hits.join("\n")).toBe("");
    });
});

describe("model ids (D13)", () => {
    it("tests and hand-written src use only synthetic ids or placeholders as model values", () => {
        const files = [
            ...listFiles(path.join(ROOT, "tests"), /\.ts$/),
            ...listFiles(path.join(ROOT, "src"), /\.ts$/).filter((f) => !rel(f).startsWith("src/internal/")),
        ];
        const bad: string[] = [];
        for (const file of files) {
            const text = readFileSync(file, "utf8");
            for (const m of text.matchAll(/\bmodel\s*:\s*["'`]([^"'`]+)["'`]/g)) {
                const value = m[1]!;
                if (!/^fixture\/[a-z0-9-]+$/.test(value) && !/^<[^>]+>$/.test(value)) bad.push(`${rel(file)}: ${value}`);
            }
        }
        expect(bad).toEqual([]);
    });
});
