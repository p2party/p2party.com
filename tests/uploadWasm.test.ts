import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const uploaderUrl = new URL("../scripts/uploadAllToS3.mjs", import.meta.url)
  .href;
const wasmKey = "vendor/p2party-1.2.3/libcrypto.wasm";

interface UploadResult {
  puts: {
    key: string;
    contentType: string;
    contentEncoding?: string;
    contentDisposition?: string;
    cacheControl: string;
    decodedMatches: boolean;
    sriMatches: boolean;
  }[];
  deletedKeys: string[];
  listCalls: number;
  localWasmUnchanged: boolean;
}

/** Exercise the actual uploader with an isolated S3 mock and disposable dist. */
const runUpload = (prune: boolean): UploadResult => {
  const result = spawnSync(
    process.execPath,
    [
      "--no-env-file",
      "--eval",
      `
      import { mock } from "bun:test";
      import { createHash } from "node:crypto";
      import { gzipSync, gunzipSync } from "node:zlib";
      import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
      import { tmpdir } from "node:os";
      import { dirname, join } from "node:path";

      const wasmKey = ${JSON.stringify(wasmKey)};
      const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
      const files = {
        "index.html": Buffer.from("<!doctype html><title>Offline upload fixture</title>"),
        "wallet/index.html": Buffer.from("<!doctype html><title>Wallet</title>"),
        "wallet/assets/signer-0123456789abcdefabcd.js": Buffer.from("void 0"),
        "wallet/restore-wallet.html": Buffer.from("<!doctype html><title>Offline</title>"),
        "wallet/SHA256SUMS": Buffer.from("test checksum"),
        "wallet/snapshot/worker.mjs": Buffer.from("void 0"),
        "wallet/help/index.html": Buffer.from("help"),
        "robots.txt": Buffer.from("User-agent: *"),
        "sitemap.xml": Buffer.from("<urlset/>"),
        "manifest.webmanifest": Buffer.from(JSON.stringify({ name: "P2Party" })),
        "assets/client.js": Buffer.from("globalThis.fixture = true;"),
        "downloads/testnet-1/wallet.tgz": gzipSync("wallet fixture"),
        "downloads/testnet-1/wallet.tgz.sha256": Buffer.from("checksum fixture"),
        [wasmKey]: wasm,
        ".well-known/apple-app-site-association": Buffer.from(JSON.stringify({
          applinks: { details: [{ appID: "Y4UAPYWG26.com.p2party.app", paths: ["/r"] }] },
        })),
      };
      const puts = [];
      const deletedKeys = [];
      let listCalls = 0;
      const hash = (bytes) => createHash("sha384").update(bytes).digest("base64");
      class Command { constructor(input) { this.input = input; } }
      class PutObjectCommand extends Command {}
      class ListObjectsV2Command extends Command {}
      class DeleteObjectsCommand extends Command {}
      class S3Client {
        async send(command) {
          const input = command.input;
          if (command instanceof PutObjectCommand) {
            const decoded = input.ContentEncoding === "gzip" ? gunzipSync(input.Body) : input.Body;
            puts.push({
              key: input.Key,
              contentType: input.ContentType,
              contentEncoding: input.ContentEncoding,
              contentDisposition: input.ContentDisposition,
              cacheControl: input.CacheControl,
              decodedMatches: decoded.equals(files[input.Key]),
              sriMatches: hash(decoded) === hash(files[input.Key]),
            });
            return {};
          }
          if (command instanceof ListObjectsV2Command) {
            listCalls++;
            return { Contents: [...Object.keys(files), "assets/older-client.js", "wallet/assets/signer-00000000000000000000.js", "obsolete.txt", "apple-developer-merchantid-domain-association"].map(Key => ({ Key })) };
          }
          if (command instanceof DeleteObjectsCommand) {
            deletedKeys.push(...input.Delete.Objects.map(({Key}) => Key));
            return {};
          }
          throw new Error("Unexpected offline upload command");
        }
      }
      mock.module("@aws-sdk/client-s3", () => ({S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand}));
      const previousDirectory = process.cwd();
      const fixture = mkdtempSync(join(tmpdir(), "p2party-web-upload-test-"));
      for (const [key, bytes] of Object.entries(files)) {
        const file = join(fixture, "dist", key);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, bytes);
      }
      process.chdir(fixture);
      try {
        // The CLI calls main() without top-level await. Wait for its final log,
        // which follows every upload and any optional prune operation.
        const originalLog = console.log;
        let completed;
        const finished = new Promise(resolve => { completed = resolve; });
        console.log = (...args) => {
          originalLog(...args);
          if (String(args[0]).startsWith("Deployment completed;")) completed();
        };
        await import(${JSON.stringify(uploaderUrl)});
        await finished;
        console.log = originalLog;
        const localWasmUnchanged = readFileSync(join(fixture, "dist", wasmKey)).equals(wasm);
        console.log("UPLOAD_TEST_RESULT=" + JSON.stringify({puts, deletedKeys, listCalls, localWasmUnchanged}));
      } finally {
        process.chdir(previousDirectory);
        rmSync(fixture, { recursive: true, force: true });
      }
      `,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 10_000,
      env: {
        PATH: process.env.PATH,
        AWS_S3_REGION: "offline-region",
        AWS_S3_BUCKET: "offline-bucket",
        AWS_S3_ACCESS_KEY: "offline-access-key",
        AWS_S3_SECRET_KEY: "offline-secret-key",
        AWS_S3_ENDPOINT: "",
        AWS_S3_PRUNE: String(prune),
        AWS_S3_REQUIRE_ANDROID_APP_LINKS: "false",
      },
    },
  );
  if (result.status !== 0)
    throw new Error(`Offline uploader failed: ${result.stderr}`);
  const line = result.stdout
    .split("\n")
    .find((value) => value.startsWith("UPLOAD_TEST_RESULT="));
  if (!line) throw new Error("Offline uploader did not finish");
  return JSON.parse(line.slice("UPLOAD_TEST_RESULT=".length)) as UploadResult;
};

describe("self-hosted WASM upload", () => {
  test("gzip preserves local bytes, decoded integrity, metadata, cache policy, and entrypoint ordering", () => {
    const result = runUpload(false);
    const wasm = result.puts.find((asset) => asset.key === wasmKey);
    expect(wasm).toMatchObject({
      contentType: "application/wasm",
      contentEncoding: "gzip",
      cacheControl: "public, max-age=31536000, immutable",
      decodedMatches: true,
      sriMatches: true,
    });
    expect(result.localWasmUnchanged).toBe(true);
    expect(
      result.puts.find((asset) => asset.key === "manifest.webmanifest")
        ?.contentType,
    ).toBe("application/manifest+json");
    expect(
      result.puts.find((asset) => asset.key.endsWith(".tgz"))?.contentType,
    ).toBe("application/gzip");
    expect(
      result.puts.find((asset) => asset.key.endsWith(".sha256"))?.contentType,
    ).toBe("text/plain");
    const keys = result.puts.map((asset) => asset.key);
    const signer = "wallet/assets/signer-0123456789abcdefabcd.js";
    expect(keys.indexOf(signer)).toBeLessThan(
      keys.indexOf("wallet/index.html"),
    );
    expect(keys.indexOf("wallet/snapshot/worker.mjs")).toBeLessThan(
      keys.indexOf("wallet/index.html"),
    );
    expect(keys.indexOf("wallet/index.html")).toBeLessThan(
      keys.indexOf("wallet/help/index.html"),
    );
    expect(
      result.puts.find((asset) => asset.key === signer)?.cacheControl,
    ).toContain("immutable");
    expect(
      result.puts.find((asset) => asset.key === "wallet/snapshot/worker.mjs")
        ?.cacheControl,
    ).toContain("no-store");
    expect(
      result.puts.find((asset) => asset.key === "wallet/SHA256SUMS")
        ?.contentType,
    ).toBe("text/plain");
    expect(
      result.puts.find((asset) => asset.key === "wallet/restore-wallet.html")
        ?.contentDisposition,
    ).toBe('attachment; filename="restore-wallet.html"');
    expect(result.puts.at(-1)?.key).toBe("index.html");
    for (const asset of result.puts.filter((asset) => asset.key !== wasmKey)) {
      expect(asset.contentEncoding).toBeUndefined();
      expect(asset.decodedMatches).toBe(true);
    }
    expect(result.puts.at(-1)?.cacheControl).toBe(
      "no-cache, no-store, must-revalidate",
    );
    for (const key of ["robots.txt", "sitemap.xml"]) {
      expect(result.puts.find((asset) => asset.key === key)?.cacheControl).toBe(
        "no-cache, no-store, must-revalidate",
      );
    }
    expect(result.listCalls).toBe(0);
    expect(result.deletedKeys).toEqual([]);
  });

  test("optional pruning still retains old hashed assets and protected remote keys", () => {
    const result = runUpload(true);
    expect(result.listCalls).toBe(1);
    expect(result.deletedKeys).toEqual(["obsolete.txt"]);
    expect(result.puts.at(-1)?.key).toBe("index.html");
    expect(result.localWasmUnchanged).toBe(true);
  });
});
