#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
