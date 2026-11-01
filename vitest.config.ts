import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8")
) as { version?: unknown };
if (typeof pkg.version !== "string" || pkg.version === "") {
  throw new Error("package.json has no version.");
}

export default defineConfig({
  define: {
    __DEVUPAI_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: "node",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
});
