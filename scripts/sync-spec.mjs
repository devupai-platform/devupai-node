/**
 * sync:spec — copies the platform's OpenAPI document into this repository.
 *
 * Source: ../openapi/devupai-v1.yaml (relative to the SDK root; only present in
 * the platform repository checkout), or the file given with `--from <path>`
 * (also `--from=<path>`), for example a release copy built outside the
 * platform's working tree.
 * Writes: openapi/devupai-v1.yaml (byte-for-byte copy) and openapi/SPEC_SHA256
 * (64 lowercase hex characters + "\n").
 *
 * Usage:
 *   npm run sync:spec
 *   npm run sync:spec -- --from <path>
 *
 * Run `npm run generate:types` afterwards.
 */

/* global console, process */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sdkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSourcePath = path.resolve(sdkRoot, "..", "openapi", "devupai-v1.yaml");
const targetDir = path.join(sdkRoot, "openapi");
const targetPath = path.join(targetDir, "devupai-v1.yaml");
const hashPath = path.join(targetDir, "SPEC_SHA256");

function sha256(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

function fail(message) {
    console.error(`sync:spec: ${message}`);
    process.exit(1);
}

/** Returns the `--from` path, or null when the option is absent. Exits on any other argument. */
function parseFrom(argv) {
    let from = null;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        let value;
        if (arg === "--from") {
            value = argv[i + 1];
            i += 1;
        } else if (arg.startsWith("--from=")) {
            value = arg.slice("--from=".length);
        } else {
            fail(`unknown argument "${arg}". Usage: sync-spec.mjs [--from <path>]`);
        }
        if (value === undefined || value === "" || value.startsWith("--")) {
            fail("--from needs a file path.");
        }
        if (from !== null) {
            fail("--from was given more than once.");
        }
        from = value;
    }
    return from;
}

const from = parseFrom(process.argv.slice(2));
const sourcePath = from === null ? defaultSourcePath : path.resolve(process.cwd(), from);

if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    fail(
        from === null
            ? `${sourcePath} not found. Run this inside the platform repository checkout, or pass --from <path>.`
            : `${sourcePath} (from --from) is not a file.`,
    );
}

const source = fs.readFileSync(sourcePath);
const sourceHash = sha256(source);

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(targetPath, source);

const copiedHash = sha256(fs.readFileSync(targetPath));
if (copiedHash !== sourceHash) {
    fail(`the copy at ${targetPath} does not match the source (sha256 ${copiedHash} != ${sourceHash}).`);
}

fs.writeFileSync(hashPath, `${sourceHash}\n`, "utf8");

console.log(`sync:spec: source ${sourcePath}`);
console.log(`sync:spec: ${path.relative(sdkRoot, targetPath)} (${source.length} bytes)`);
console.log(`sync:spec: ${path.relative(sdkRoot, hashPath)} = ${sourceHash}`);
