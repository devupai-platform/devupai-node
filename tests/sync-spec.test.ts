import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// The script resolves its paths from its own location, so each test runs a copy of it inside a
// temporary layout: <root>/openapi/devupai-v1.yaml (the default source, as in the platform
// checkout) and <root>/sdk/scripts/sync-spec.mjs, which writes into <root>/sdk/openapi/.
const scriptSource = fileURLToPath(new URL("../scripts/sync-spec.mjs", import.meta.url));

const sha256 = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");

let root: string;
let sdk: string;

function run(args: string[], cwd: string = sdk) {
  const result = spawnSync(process.execPath, [path.join(sdk, "scripts", "sync-spec.mjs"), ...args], {
    cwd,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const vendored = () => path.join(sdk, "openapi", "devupai-v1.yaml");
const vendoredHash = () => path.join(sdk, "openapi", "SPEC_SHA256");

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "sync-spec-"));
  sdk = path.join(root, "sdk");
  mkdirSync(path.join(sdk, "scripts"), { recursive: true });
  copyFileSync(scriptSource, path.join(sdk, "scripts", "sync-spec.mjs"));
  mkdirSync(path.join(root, "openapi"), { recursive: true });
  writeFileSync(path.join(root, "openapi", "devupai-v1.yaml"), "openapi: 3.1.0\n# default source\n");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("sync-spec.mjs", () => {
  it("copies ../openapi/devupai-v1.yaml and writes its sha256 when no option is given", () => {
    const result = run([]);
    expect(result.status).toBe(0);
    const expected = readFileSync(path.join(root, "openapi", "devupai-v1.yaml"));
    expect(readFileSync(vendored())).toEqual(expected);
    expect(readFileSync(vendoredHash(), "utf8")).toBe(`${sha256(expected)}\n`);
  });

  it("copies the file given with --from <path>, byte for byte, and writes its sha256", () => {
    const release = path.join(root, "release", "devupai-v1.yaml");
    mkdirSync(path.dirname(release), { recursive: true });
    // CRLF and a non-ASCII character must survive the copy unchanged.
    const content = Buffer.from(`openapi: 3.1.0\r\ninfo:\n  title: release copy ${String.fromCharCode(0xe9)}\n`);
    writeFileSync(release, content);

    const result = run(["--from", release]);
    expect(result.status).toBe(0);
    expect(readFileSync(vendored())).toEqual(content);
    expect(readFileSync(vendoredHash(), "utf8")).toBe(`${sha256(content)}\n`);
    expect(result.stdout).toContain(sha256(content));
  });

  it("accepts --from=<path> and resolves a relative path from the current directory", () => {
    writeFileSync(path.join(root, "relative.yaml"), "openapi: 3.1.0\n# relative\n");
    const result = run(["--from=relative.yaml"], root);
    expect(result.status).toBe(0);
    expect(readFileSync(vendored(), "utf8")).toBe("openapi: 3.1.0\n# relative\n");
  });

  it.each([
    [["--from"], "--from needs a file path."],
    [["--from", "--other"], "--from needs a file path."],
    [["--from="], "--from needs a file path."],
    [["--from", "a.yaml", "--from", "b.yaml"], "--from was given more than once."],
    [["--to", "x"], 'unknown argument "--to"'],
  ])("exits 1 and writes nothing for the arguments %j", (args, message) => {
    writeFileSync(path.join(root, "a.yaml"), "a\n");
    writeFileSync(path.join(root, "b.yaml"), "b\n");
    const result = run(args, root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(existsSync(vendored())).toBe(false);
    expect(existsSync(vendoredHash())).toBe(false);
  });

  it("exits 1 and writes nothing when the --from file does not exist", () => {
    const result = run(["--from", path.join(root, "missing.yaml")]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("is not a file");
    expect(existsSync(vendored())).toBe(false);
  });

  it("exits 1 when --from names a directory", () => {
    const result = run(["--from", root]);
    expect(result.status).toBe(1);
    expect(existsSync(vendored())).toBe(false);
  });
});
