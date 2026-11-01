import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8")
) as { version?: unknown };
if (typeof pkg.version !== "string" || pkg.version === "") {
  throw new Error("package.json has no version.");
}

const define = { __DEVUPAI_VERSION__: JSON.stringify(pkg.version) };

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: false,
    target: "node22",
    platform: "node",
    define,
    // Neither build cleans `dist/`: the two builds run at the same time, so a
    // clean in one could remove files the other has just written.
    // `npm run build` removes `dist/` first with scripts/clean-dist.mjs.
    clean: false,
  },
  {
    entry: { provider: "src/provider.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: false,
    target: "node22",
    platform: "node",
    define,
    clean: false,
    external: ["ai", "@ai-sdk/openai-compatible", "@ai-sdk/provider", "@ai-sdk/provider-utils"],
  },
]);
