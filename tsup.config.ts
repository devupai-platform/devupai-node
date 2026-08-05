import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/provider.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: false,
  clean: true,
});
