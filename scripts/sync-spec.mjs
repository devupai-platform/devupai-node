/**
 * sync:spec — copies the platform's OpenAPI document into this repository.
 *
 * Source: ../openapi/devupai-v1.yaml (relative to the SDK root; only present in
 * the platform repository checkout).
 * Writes: openapi/devupai-v1.yaml (byte-for-byte copy) and openapi/SPEC_SHA256
 * (64 lowercase hex characters + "\n").
 *
 * Run `npm run generate:types` afterwards.
 */

/* global console, process */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sdkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.resolve(sdkRoot, "..", "openapi", "devupai-v1.yaml");
const targetDir = path.join(sdkRoot, "openapi");
const targetPath = path.join(targetDir, "devupai-v1.yaml");
const hashPath = path.join(targetDir, "SPEC_SHA256");

function sha256(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

if (!fs.existsSync(sourcePath)) {
    console.error(
        `sync:spec: ${sourcePath} not found. Run this inside the platform repository checkout.`,
    );
    process.exit(1);
}

const source = fs.readFileSync(sourcePath);
const sourceHash = sha256(source);

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(targetPath, source);

const copiedHash = sha256(fs.readFileSync(targetPath));
if (copiedHash !== sourceHash) {
    console.error(
        `sync:spec: the copy at ${targetPath} does not match the source (sha256 ${copiedHash} != ${sourceHash}).`,
    );
    process.exit(1);
}

fs.writeFileSync(hashPath, `${sourceHash}\n`, "utf8");

console.log(`sync:spec: ${path.relative(sdkRoot, targetPath)} (${source.length} bytes)`);
console.log(`sync:spec: ${path.relative(sdkRoot, hashPath)} = ${sourceHash}`);
