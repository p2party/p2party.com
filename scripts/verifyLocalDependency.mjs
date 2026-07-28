#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageJson = JSON.parse(
  readFileSync(path.join(projectRoot, "package.json"), "utf8"),
);
const packageLock = JSON.parse(
  readFileSync(path.join(projectRoot, "package-lock.json"), "utf8"),
);
const dependency = packageJson.dependencies?.p2party;

if (typeof dependency !== "string" || !dependency.startsWith("file:"))
  throw new Error("p2party must be an explicit file: release artifact");

const artifactPath = path.resolve(
  projectRoot,
  dependency.slice("file:".length),
);
const artifactRelativePath = path.relative(projectRoot, artifactPath);
const artifactIsExternal =
  artifactRelativePath === ".." ||
  artifactRelativePath.startsWith(`..${path.sep}`) ||
  path.isAbsolute(artifactRelativePath);
if (artifactIsExternal) {
  const message =
    "p2party uses a sibling artifact; a public release must vendor the immutable tarball inside this repository";
  if (process.env.CI === "true") throw new Error(message);
  console.warn(`WARNING: ${message}`);
}

if (!existsSync(artifactPath))
  throw new Error(`Missing p2party release artifact: ${artifactPath}`);

const lockEntry = packageLock.packages?.["node_modules/p2party"];
if (lockEntry?.resolved !== dependency)
  throw new Error("package-lock.json resolves a different p2party artifact");
if (typeof lockEntry.version !== "string")
  throw new Error("package-lock.json has no p2party package version");
const expectedDependency = `file:vendor/p2party-${lockEntry.version}.tgz`;
if (dependency !== expectedDependency)
  throw new Error(
    `p2party dependency must be the version-matched artifact ${expectedDependency}`,
  );

const artifact = readFileSync(artifactPath);
const integrity = `sha512-${createHash("sha512")
  .update(artifact)
  .digest("base64")}`;
if (lockEntry.integrity !== integrity)
  throw new Error(
    "p2party artifact does not match package-lock.json integrity",
  );

const sha256 = createHash("sha256").update(artifact).digest("hex");
console.log(`p2party artifact SHA-256: ${sha256}`);

const tarString = (bytes) => {
  const terminator = bytes.indexOf(0);
  return bytes
    .subarray(0, terminator === -1 ? bytes.length : terminator)
    .toString("utf8");
};

const extractTarEntry = (tarball, wantedPath) => {
  const archive = gunzipSync(tarball);
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    const name = tarString(header.subarray(0, 100));
    if (!name) break;
    const prefix = tarString(header.subarray(345, 500));
    const entryPath = prefix ? `${prefix}/${name}` : name;
    const sizeText = tarString(header.subarray(124, 136)).trim();
    const size = Number.parseInt(sizeText || "0", 8);
    if (!Number.isSafeInteger(size) || size < 0)
      throw new Error(`Invalid tar entry size for ${entryPath}`);

    const dataOffset = offset + 512;
    if (dataOffset + size > archive.length)
      throw new Error(`Truncated tar entry: ${entryPath}`);
    if (entryPath === wantedPath)
      return archive.subarray(dataOffset, dataOffset + size);
    offset = dataOffset + Math.ceil(size / 512) * 512;
  }
  throw new Error(`Missing tar entry: ${wantedPath}`);
};

const packagedWasm = extractTarEntry(artifact, "package/lib/libcrypto.wasm");
const packagedManifest = JSON.parse(
  extractTarEntry(artifact, "package/package.json").toString("utf8"),
);
if (packagedManifest.version !== lockEntry.version)
  throw new Error("p2party tarball version differs from package-lock.json");
const packagedProvenance = JSON.parse(
  extractTarEntry(artifact, "package/lib/libcrypto.provenance.json").toString(
    "utf8",
  ),
);
const publicWasmPath = path.join(
  projectRoot,
  "public",
  "vendor",
  `p2party-${lockEntry.version}`,
  "libcrypto.wasm",
);
const expectedRuntimeWasmPath = `/vendor/p2party-${lockEntry.version}/libcrypto.wasm`;
const runtimeWasmSource = readFileSync(
  path.join(projectRoot, "src", "protocol", "wasm.ts"),
  "utf8",
);
const configuredRuntimePaths = [
  ...runtimeWasmSource.matchAll(/SELF_HOSTED_WASM_PATH\s*=\s*"([^"]+)"/gu),
].map(([, configuredPath]) => configuredPath);
if (
  configuredRuntimePaths.length !== 1 ||
  configuredRuntimePaths[0] !== expectedRuntimeWasmPath
)
  throw new Error(
    `frontend runtime WASM path must be ${expectedRuntimeWasmPath}`,
  );
if (!existsSync(publicWasmPath))
  throw new Error(`Missing self-hosted p2party WASM: ${publicWasmPath}`);
const publicWasm = readFileSync(publicWasmPath);
const wasmSha256 = createHash("sha256").update(packagedWasm).digest("hex");
if (
  packagedProvenance.artifact?.bytes !== packagedWasm.byteLength ||
  packagedProvenance.artifact?.sha256 !== wasmSha256
)
  throw new Error("p2party tarball WASM does not match its provenance");
if (!publicWasm.equals(packagedWasm))
  throw new Error("self-hosted frontend WASM differs from the p2party tarball");
console.log(`p2party WASM SHA-256: ${wasmSha256}`);
