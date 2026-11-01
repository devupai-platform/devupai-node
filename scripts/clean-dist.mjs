/**
 * clean-dist — removes the build output folder `dist/` of this package before
 * a build (`npm run build` runs it, then tsup).
 *
 * Usage: node scripts/clean-dist.mjs   (takes no arguments)
 *
 * The folder is resolved from this script's own location, never from the
 * current directory or an argument, and the script refuses to remove anything
 * other than `<package root>/dist`.
 */

/* global console, process */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SDK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST_PATH = path.join(SDK_ROOT, "dist");

function fail(message) {
    console.error(`clean-dist: ${message}`);
    process.exit(1);
}

if (process.argv.length > 2) {
    fail("this script takes no arguments; it only removes the package's dist/ folder.");
}

// The target must be exactly <package root>/dist.
if (path.dirname(DIST_PATH) !== SDK_ROOT || path.basename(DIST_PATH) !== "dist") {
    fail(`refusing to remove ${DIST_PATH}: it is not the dist/ folder of the package.`);
}

// The package root must be this package.
let manifest;
try {
    manifest = JSON.parse(fs.readFileSync(path.join(SDK_ROOT, "package.json"), "utf8"));
} catch (error) {
    fail(`cannot read ${path.join(SDK_ROOT, "package.json")}: ${error instanceof Error ? error.message : String(error)}`);
}
if (manifest === null || typeof manifest !== "object" || manifest.name !== "devupai") {
    fail(`refusing to remove ${DIST_PATH}: ${SDK_ROOT} is not the devupai package root.`);
}

let stats;
try {
    stats = fs.lstatSync(DIST_PATH);
} catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        console.log("clean-dist: dist/ does not exist; nothing to remove");
        process.exit(0);
    }
    fail(`cannot inspect ${DIST_PATH}: ${error instanceof Error ? error.message : String(error)}`);
}
if (!stats.isDirectory() || stats.isSymbolicLink()) {
    fail(`refusing to remove ${DIST_PATH}: it is not a plain directory.`);
}

try {
    fs.rmSync(DIST_PATH, { recursive: true, force: true });
} catch (error) {
    fail(`could not remove ${DIST_PATH}: ${error instanceof Error ? error.message : String(error)}`);
}
console.log("clean-dist: removed dist/");
