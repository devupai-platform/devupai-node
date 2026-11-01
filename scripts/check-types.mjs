/**
 * check:types — verifies that the generated types match the vendored spec.
 *
 * 1. sha256 of openapi/devupai-v1.yaml must equal openapi/SPEC_SHA256.
 * 2. Regenerating the schema (into a temporary directory, same flags as
 *    generate:types) must give the committed src/internal/openapi-schema.ts
 *    (line endings normalised to LF before comparing).
 *
 * Usage: node scripts/check-types.mjs [--spec <yaml>] [--hash <file>] [--schema <ts>]
 * The optional paths (resolved from the current directory) default to the
 * repository files; they exist so the check itself can be tested on copies.
 * Exit 0 when everything matches, 1 otherwise.
 */

/* global console, process */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import { generateSchema, HASH_PATH, SCHEMA_PATH, SDK_ROOT, SPEC_PATH } from "./generate-types.mjs";

const FIX_HINT =
    "Run `npm run sync:spec` (from the platform repository checkout), then `npm run generate:types`, and commit the results.";

function fail(message) {
    console.error(`check:types: ${message}`);
    process.exit(1);
}

function toLf(text) {
    return text.replace(/\r\n/g, "\n");
}

function display(filePath) {
    const relative = path.relative(SDK_ROOT, filePath);
    return relative.startsWith("..") || path.isAbsolute(relative) ? filePath : relative;
}

let values;
try {
    ({ values } = parseArgs({
        options: {
            spec: { type: "string" },
            hash: { type: "string" },
            schema: { type: "string" },
        },
        strict: true,
        allowPositionals: false,
    }));
} catch (error) {
    fail(`${error instanceof Error ? error.message : String(error)}\nUsage: node scripts/check-types.mjs [--spec <yaml>] [--hash <file>] [--schema <ts>]`);
}

const specPath = values.spec ? path.resolve(values.spec) : SPEC_PATH;
const hashPath = values.hash ? path.resolve(values.hash) : HASH_PATH;
const schemaPath = values.schema ? path.resolve(values.schema) : SCHEMA_PATH;

for (const required of [specPath, hashPath, schemaPath]) {
    if (!fs.existsSync(required)) {
        fail(`${display(required)} is missing. ${FIX_HINT}`);
    }
}

// (1) The vendored spec must match its recorded hash.
const expectedHash = fs.readFileSync(hashPath, "utf8").trim();
if (!/^[0-9a-f]{64}$/.test(expectedHash)) {
    fail(`${display(hashPath)} must contain one lowercase sha256 hex digest. ${FIX_HINT}`);
}
const actualHash = crypto.createHash("sha256").update(fs.readFileSync(specPath)).digest("hex");
if (actualHash !== expectedHash) {
    fail(
        `${display(specPath)} has sha256 ${actualHash}, but ${display(hashPath)} records ${expectedHash}. ` +
            "The vendored spec was edited or its line endings changed (it must stay byte-exact). " +
            FIX_HINT,
    );
}

// (2) The committed schema must equal a fresh generation.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "devupai-check-types-"));
const tempOut = path.join(tempDir, "openapi-schema.ts");
let fresh;
let generationError;
try {
    generateSchema({ specPath, outPath: tempOut, quiet: true });
    fresh = toLf(fs.readFileSync(tempOut, "utf8"));
} catch (error) {
    generationError = error;
} finally {
    // One call removes the directory and anything left in it; `force` ignores a
    // path that was never created, so a failed generation is reported, not the cleanup.
    fs.rmSync(tempDir, { recursive: true, force: true });
}
if (generationError !== undefined) {
    fail(
        `could not regenerate the schema: ${generationError instanceof Error ? generationError.message : String(generationError)}`,
    );
}

const committed = toLf(fs.readFileSync(schemaPath, "utf8"));
if (committed !== fresh) {
    const committedLines = committed.split("\n");
    const freshLines = fresh.split("\n");
    let line = 0;
    while (line < committedLines.length && line < freshLines.length && committedLines[line] === freshLines[line]) {
        line += 1;
    }
    fail(
        `${display(schemaPath)} differs from the schema generated from ${display(specPath)} ` +
            `(first difference at line ${line + 1}). Do not edit the generated file by hand; run \`npm run generate:types\` and commit the result.`,
    );
}

console.log(`check:types: ${display(specPath)} matches ${display(hashPath)} (${actualHash})`);
console.log(`check:types: ${display(schemaPath)} is up to date`);
