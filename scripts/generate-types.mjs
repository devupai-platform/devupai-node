/**
 * generate:types — generates src/internal/openapi-schema.ts from the vendored
 * openapi/devupai-v1.yaml with the local openapi-typescript CLI.
 *
 * Usage: node scripts/generate-types.mjs
 *
 * `generateSchema()` is also used by scripts/check-types.mjs.
 */

/* global console, process */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SDK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SPEC_PATH = path.join(SDK_ROOT, "openapi", "devupai-v1.yaml");
export const HASH_PATH = path.join(SDK_ROOT, "openapi", "SPEC_SHA256");
export const SCHEMA_PATH = path.join(SDK_ROOT, "src", "internal", "openapi-schema.ts");

/** Flags passed to openapi-typescript (generate and check must use the same set). */
export const GENERATOR_FLAGS = Object.freeze(["--default-non-nullable=false"]);

/** Absolute path of the openapi-typescript CLI entry installed in node_modules. */
export function resolveGeneratorCli() {
    const require = createRequire(path.join(SDK_ROOT, "package.json"));
    let packageJsonPath;
    try {
        packageJsonPath = require.resolve("openapi-typescript/package.json");
    } catch (error) {
        throw new Error(
            "openapi-typescript is not installed. Run `npm ci` in the SDK root first.",
            { cause: error },
        );
    }
    const manifest = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.["openapi-typescript"];
    if (typeof bin !== "string") {
        throw new Error(`openapi-typescript at ${packageJsonPath} declares no CLI entry.`);
    }
    return path.resolve(path.dirname(packageJsonPath), bin);
}

/**
 * Runs openapi-typescript on `specPath` and writes the result to `outPath`.
 * Throws an Error with the CLI output when the run does not succeed.
 */
export function generateSchema({ specPath = SPEC_PATH, outPath = SCHEMA_PATH, quiet = false } = {}) {
    if (!fs.existsSync(specPath)) {
        throw new Error(`${specPath} not found. Run \`npm run sync:spec\` from the platform repository checkout.`);
    }
    const cli = resolveGeneratorCli();
    const args = [
        cli,
        pathToFileURL(path.resolve(specPath)).href,
        "--output",
        path.resolve(outPath),
        ...GENERATOR_FLAGS,
    ];
    const result = spawnSync(process.execPath, args, {
        cwd: SDK_ROOT,
        shell: false,
        encoding: "utf8",
        windowsHide: true,
    });
    if (result.error) {
        throw new Error(`openapi-typescript could not start: ${result.error.message}`, { cause: result.error });
    }
    if (result.status !== 0) {
        throw new Error(
            `openapi-typescript exited with ${result.status ?? result.signal}.\n${result.stdout ?? ""}${result.stderr ?? ""}`,
        );
    }
    if (!quiet) {
        process.stdout.write(result.stdout ?? "");
        process.stderr.write(result.stderr ?? "");
    }
    if (!fs.existsSync(outPath)) {
        throw new Error(`openapi-typescript reported success but wrote no file at ${outPath}.`);
    }
}

const invokedDirectly =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
    try {
        generateSchema();
        console.log(`generate:types: ${path.relative(SDK_ROOT, SCHEMA_PATH)} written`);
    } catch (error) {
        console.error(`generate:types: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}
