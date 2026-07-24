#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { getMimeTypeFromExtension } from "./getMimeTypeFromExtension.mjs";

const buildDir = path.resolve("dist");
const entrypointKeys = new Set(["index.html"]);
const expectedAppleAppId = "Y4UAPYWG26.com.p2party.app";
const protectedRemoteKeys = new Set([
  "robots.txt",
  "apple-developer-merchantid-domain-association",
  ".well-known/apple-developer-merchantid-domain-association",
]);

const requiredEnvironment = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required deployment variable ${name}`);
  return value;
};

const environmentBoolean = (name, fallback) => {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be either true or false`);
};

const region = requiredEnvironment("AWS_S3_REGION");
const bucket = requiredEnvironment("AWS_S3_BUCKET");
const accessKeyId = requiredEnvironment("AWS_S3_ACCESS_KEY");
const secretAccessKey = requiredEnvironment("AWS_S3_SECRET_KEY");
const endpointValue = process.env.AWS_S3_ENDPOINT?.trim();
const endpointUrl = endpointValue ? new URL(endpointValue) : undefined;
if (
  endpointUrl &&
  (endpointUrl.protocol !== "https:" ||
    endpointUrl.username !== "" ||
    endpointUrl.password !== "" ||
    endpointUrl.search !== "" ||
    endpointUrl.hash !== "")
)
  throw new Error(
    "AWS_S3_ENDPOINT must be an HTTPS URL without credentials, query, or fragment",
  );
const endpoint = endpointUrl?.toString();
const prune = environmentBoolean("AWS_S3_PRUNE", false);
const requireAndroidAppLinks = environmentBoolean(
  "AWS_S3_REQUIRE_ANDROID_APP_LINKS",
  true,
);

const client = new S3Client({
  region,
  ...(endpoint ? { endpoint } : {}),
  credentials: { accessKeyId, secretAccessKey },
});

const getDirFiles = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  const files = [];
  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Refusing to deploy symbolic link ${absolutePath}`);
    if (entry.isDirectory()) {
      files.push(...(await getDirFiles(absolutePath)));
      continue;
    }
    if (!entry.isFile())
      throw new Error(`Refusing to deploy non-regular file ${absolutePath}`);
    files.push(absolutePath);
  }
  return files;
};

const objectKey = (absolutePath) => {
  const relativePath = path.relative(buildDir, absolutePath);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  )
    throw new Error(`Build file escaped dist/: ${absolutePath}`);
  return relativePath.split(path.sep).join("/");
};

const contentTypeForKey = (key) => {
  if (
    key === ".well-known/apple-app-site-association" ||
    key === ".well-known/assetlinks.json"
  )
    return "application/json";
  return getMimeTypeFromExtension(path.extname(key).slice(1));
};

const cacheControlForKey = (key) => {
  if (entrypointKeys.has(key) || key.startsWith(".well-known/"))
    return "no-cache, no-store, must-revalidate";
  if (key.startsWith("assets/")) return "public, max-age=31536000, immutable";
  return "public, max-age=3600";
};

const validateAppleAssociation = async () => {
  const associationPath = path.join(
    buildDir,
    ".well-known",
    "apple-app-site-association",
  );
  const association = JSON.parse(await fs.readFile(associationPath, "utf8"));
  const details = association?.applinks?.details;
  if (!Array.isArray(details) || details.length !== 1)
    throw new Error("Apple association must have exactly one applinks detail");
  for (const detail of details) {
    if (detail.appID !== expectedAppleAppId)
      throw new Error(`Apple association appID must be ${expectedAppleAppId}`);
    if (
      !Array.isArray(detail.paths) ||
      detail.paths.length !== 1 ||
      detail.paths[0] !== "/r"
    )
      throw new Error("Apple association must be restricted to exactly /r");
  }
};

const validateAndroidAssociation = async () => {
  const associationPath = path.join(buildDir, ".well-known", "assetlinks.json");
  let source;
  try {
    source = await fs.readFile(associationPath, "utf8");
  } catch (cause) {
    if (cause?.code !== "ENOENT") throw cause;
    const message =
      "Android verified links are enabled in the manifest, but dist/.well-known/assetlinks.json is missing";
    if (requireAndroidAppLinks) throw new Error(message);
    console.warn(`WARNING: ${message}`);
    return;
  }

  const statements = JSON.parse(source);
  const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/u;
  const appStatement = Array.isArray(statements)
    ? statements.find(
        ({ relation, target }) =>
          Array.isArray(relation) &&
          relation.includes("delegate_permission/common.handle_all_urls") &&
          target?.namespace === "android_app" &&
          target?.package_name === "com.p2party.app",
      )
    : undefined;
  const fingerprints = appStatement?.target?.sha256_cert_fingerprints;
  if (
    !Array.isArray(fingerprints) ||
    fingerprints.length === 0 ||
    fingerprints.some(
      (fingerprint) =>
        typeof fingerprint !== "string" ||
        !fingerprintPattern.test(fingerprint),
    )
  )
    throw new Error(
      "Android assetlinks.json has no valid com.p2party.app SHA-256 certificate fingerprint",
    );
};

const listRemoteKeys = async () => {
  const keys = [];
  let continuationToken;
  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
      }),
    );
    for (const object of response.Contents ?? [])
      if (typeof object.Key === "string") keys.push(object.Key);
    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
    if (response.IsTruncated && !continuationToken)
      throw new Error("S3 listing was truncated without a continuation token");
  } while (continuationToken);
  return keys;
};

const deleteRemoteKeys = async (keys) => {
  for (let offset = 0; offset < keys.length; offset += 1000) {
    const batch = keys.slice(offset, offset + 1000);
    const response = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
    if ((response.Errors ?? []).length > 0)
      throw new Error(
        `S3 refused to delete ${response.Errors.length} stale object(s)`,
      );
  }
};

const main = async () => {
  const buildStat = await fs.stat(buildDir);
  if (!buildStat.isDirectory()) throw new Error("dist/ is not a directory");

  await validateAppleAssociation();
  await validateAndroidAssociation();

  const files = await getDirFiles(buildDir);
  const objects = files.map((absolutePath) => ({
    absolutePath,
    key: objectKey(absolutePath),
  }));
  if (!objects.some(({ key }) => key === "index.html"))
    throw new Error("dist/index.html is missing");

  objects.sort((left, right) => {
    const leftEntrypoint = entrypointKeys.has(left.key) ? 1 : 0;
    const rightEntrypoint = entrypointKeys.has(right.key) ? 1 : 0;
    return (
      leftEntrypoint - rightEntrypoint || left.key.localeCompare(right.key)
    );
  });

  console.log(
    `Uploading ${objects.length} files to ${bucket}${endpoint ? ` via ${endpoint}` : ""}`,
  );
  for (const { absolutePath, key } of objects) {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: await fs.readFile(absolutePath),
        ContentType: contentTypeForKey(key),
        CacheControl: cacheControlForKey(key),
      }),
    );
  }

  if (prune) {
    const desiredKeys = new Set(objects.map(({ key }) => key));
    const remoteKeys = await listRemoteKeys();
    const staleKeys = remoteKeys.filter(
      (key) =>
        !desiredKeys.has(key) &&
        !protectedRemoteKeys.has(key) &&
        !key.startsWith("assets/"),
    );
    if (staleKeys.length > 0) {
      await deleteRemoteKeys(staleKeys);
      console.log(`Deleted ${staleKeys.length} stale non-asset object(s)`);
    }
  } else {
    console.log("Remote pruning disabled (AWS_S3_PRUNE=false)");
  }

  console.log(
    "Deployment completed; entrypoint uploaded last and old hashed assets retained",
  );
};

main().catch((cause) => {
  console.error(
    `Deployment failed: ${cause instanceof Error ? cause.message : String(cause)}`,
  );
  process.exitCode = 1;
});
