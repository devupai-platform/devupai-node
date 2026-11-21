// The package admits every Node.js 22 release (`engines.node` is `>=22.0.0` from 4.3.0),
// and the CI matrix runs that floor release, so the floor is tested and not only declared.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(__dirname, "..");
const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { engines?: { node?: string } };
const ci = readFileSync(path.join(ROOT, ".github", "workflows", "ci.yml"), "utf8");

function matrixVersions(workflow: string): string[] {
    const list = /node-version:\s*\[([^\]]*)\]/.exec(workflow)?.[1] ?? "";
    return list
        .split(",")
        .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
        .filter((entry) => entry !== "");
}

describe("Node.js floor", () => {
    it("engines.node is >=22.0.0", () => {
        expect(pkg.engines?.node).toBe(">=22.0.0");
    });

    it("the CI matrix runs the floor release 22.0.0 next to the current 22 and 24 lines", () => {
        expect(matrixVersions(ci)).toEqual(expect.arrayContaining(["22.0.0", "22", "24"]));
    });
});
