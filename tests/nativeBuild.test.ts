import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import viteConfig, {
  documentedWebPolicy,
  nativeContentSecurityPolicy,
} from "../vite.config";
import capacitorConfig from "../capacitor.config";

import type { HtmlTagDescriptor, Plugin, UserConfig } from "vite";

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

/**
 * The Xcode "Check bundled web client" phase, as Xcode runs it: the script
 * string from the project file, unescaped, under /bin/sh with SRCROOT set.
 */
const xcodeBundleCheck = (): string => {
  const project = read("../ios/App/App.xcodeproj/project.pbxproj");
  const phase =
    /\/\* Check bundled web client \*\/ = \{[^}]*?shellScript = "((?:[^"\\]|\\.)*)";/.exec(
      project,
    );
  if (phase === null) throw new Error("no Check bundled web client phase");
  return phase[1].replace(/\\(.)/g, (_, character: string) =>
    character === "n" ? "\n" : character === "t" ? "\t" : character,
  );
};

/** A checkout with only what the phase reads, and the phase run against it. */
const runXcodeBundleCheck = (bundle: {
  vendored: string;
  scripts: Record<string, string>;
  index?: string;
}) => {
  const root = mkdtempSync(join(tmpdir(), "bundle-check-"));
  try {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            p2party: `file:vendor/p2party-${bundle.vendored}.tgz`,
          },
        },
        null,
        2,
      ),
    );
    const assets = join(root, "ios", "App", "App", "public", "assets");
    mkdirSync(assets, { recursive: true });
    for (const [name, text] of Object.entries(bundle.scripts))
      writeFileSync(join(assets, name), text);
    if (bundle.index !== undefined)
      writeFileSync(join(assets, "..", "index.html"), bundle.index);
    const run = spawnSync("/bin/sh", ["-c", xcodeBundleCheck()], {
      env: { PATH: process.env.PATH, SRCROOT: join(root, "ios", "App") },
      encoding: "utf8",
    });
    return { status: run.status, stderr: run.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const wasmChunk = (version: string) =>
  `const a="/vendor/p2party-${version}/libcrypto.wasm";export{a as S};`;
const nativeIndex =
  '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;self&#39;"><meta charset="UTF-8" /></head><body></body></html>';
const webIndex =
  '<!doctype html><html><head><meta charset="UTF-8" /></head><body></body></html>';

const buildConfig = (mode: string) =>
  (
    viteConfig as (env: {
      command: "build";
      mode: string;
      isSsrBuild: boolean;
      isPreview: boolean;
    }) => UserConfig
  )({ command: "build", mode, isSsrBuild: false, isPreview: false });

const safariTargets = (mode: string) =>
  ([buildConfig(mode).build?.target ?? []].flat() as string[]).filter(
    (target) => target.startsWith("safari"),
  );

const nativeMetaTags = async (mode: string) => {
  const config = buildConfig(mode);
  const plugin = (config.plugins as Plugin[]).find(
    (candidate) => candidate.name === "native-content-security-policy",
  );
  const transform = plugin?.transformIndexHtml as () =>
    HtmlTagDescriptor[] | Promise<HtmlTagDescriptor[]>;
  return await transform();
};

describe("native Content-Security-Policy", () => {
  test("is the documented web policy plus the iOS app origin", () => {
    // Written out in full so a change to the documented policy, or to how it
    // is carried over, has to change this line too.
    expect(
      nativeContentSecurityPolicy(
        documentedWebPolicy(read("../docs/deployment.md")),
      ),
    ).toBe(
      "default-src 'self' capacitor://localhost; base-uri 'none'; object-src 'none'; form-action 'self' capacitor://localhost; script-src 'self' 'wasm-unsafe-eval' capacitor://localhost; style-src 'self' 'unsafe-inline' capacitor://localhost; img-src 'self' data: blob: capacitor://localhost; media-src 'self' data: blob: capacitor://localhost; connect-src 'self' https: wss: capacitor://localhost; worker-src 'self' blob: capacitor://localhost; manifest-src 'self' capacitor://localhost",
    );

    // frame-ancestors goes; the origin is added only beside 'self'.
    expect(
      nativeContentSecurityPolicy(
        " default-src 'self'; frame-ancestors 'none';img-src data: ;",
      ),
    ).toBe("default-src 'self' capacitor://localhost; img-src data:");
    expect(() => documentedWebPolicy("# Deployment\n")).toThrow(
      "no Content-Security-Policy line",
    );
  });

  test("only the native build carries it", async () => {
    const native = await nativeMetaTags("native");
    expect(native).toHaveLength(1);
    expect(native[0].tag).toBe("meta");
    expect(native[0].injectTo).toBe("head-prepend");
    expect(native[0].attrs).toEqual({
      "http-equiv": "Content-Security-Policy",
      content: nativeContentSecurityPolicy(
        documentedWebPolicy(read("../docs/deployment.md")),
      ),
    });

    // The web gets the policy from the CDN as a header, with frame-ancestors.
    expect(await nativeMetaTags("production")).toEqual([]);
    expect(JSON.parse(read("../package.json")).scripts["build:native"]).toBe(
      "vite build --mode native",
    );
  });
});

describe("native build hygiene", () => {
  // cap sync writes <access origin="*"/> into config.xml unless a list is
  // given. Nothing in these apps reads it, so it is written empty.
  test("Capacitor writes no wildcard Cordova access rule", () => {
    expect(capacitorConfig.cordova?.accessOrigins).toEqual([]);
  });

  test("both native builds check the bundled web client first", () => {
    const gradle = read("../android/app/build.gradle");
    expect(gradle).toContain("tasks.register('checkBundledWebClient')");
    expect(gradle).toContain(
      "tasks.named('preBuild') { dependsOn checkBundledWebClient }",
    );

    const project = read("../ios/App/App.xcodeproj/project.pbxproj");
    const phases = /buildPhases = \(([^)]*)\);/.exec(project)?.[1] ?? "";
    const check = phases.indexOf("/* Check bundled web client */");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(phases.indexOf("/* Resources */"));
  });

  test("the Xcode check refuses a stale, missing or web-flavoured bundle", () => {
    const stale = runXcodeBundleCheck({
      vendored: "0.15.0",
      scripts: { "wasm-a.js": wasmChunk("0.14.10"), "index-b.js": "x" },
      index: nativeIndex,
    });
    expect(stale.status).not.toBe(0);
    expect(stale.stderr).toContain(
      "loads p2party 0.14.10, but package.json vendors 0.15.0",
    );

    const mixed = runXcodeBundleCheck({
      vendored: "0.15.0",
      scripts: { "a.js": wasmChunk("0.15.0"), "b.js": wasmChunk("0.14.10") },
      index: nativeIndex,
    });
    expect(mixed.status).not.toBe(0);
    expect(mixed.stderr).toContain("loads p2party 0.14.10 0.15.0");

    const noIndex = runXcodeBundleCheck({
      vendored: "0.15.0",
      scripts: { "wasm-a.js": wasmChunk("0.15.0") },
    });
    expect(noIndex.status).not.toBe(0);
    expect(noIndex.stderr).toContain("no Content-Security-Policy meta element");

    const webFlavoured = runXcodeBundleCheck({
      vendored: "0.15.0",
      scripts: { "wasm-a.js": wasmChunk("0.15.0") },
      index: webIndex,
    });
    expect(webFlavoured.status).not.toBe(0);
    expect(webFlavoured.stderr).toContain(
      "no Content-Security-Policy meta element",
    );

    const empty = runXcodeBundleCheck({
      vendored: "0.15.0",
      scripts: {},
      index: nativeIndex,
    });
    expect(empty.status).not.toBe(0);
    expect(empty.stderr).toContain("from no vendor path");
  });

  test("the Xcode check accepts a current native bundle", () => {
    const current = runXcodeBundleCheck({
      vendored: "0.15.0",
      scripts: { "wasm-a.js": wasmChunk("0.15.0"), "index-b.js": "x" },
      index: nativeIndex,
    });
    expect(current).toEqual({ status: 0, stderr: "" });
  });

  // The policy admits the cryptography WASM only through 'wasm-unsafe-eval'.
  // An iOS whose WebKit lacks that keyword would install the app and then
  // refuse every cryptographic operation, so it must not be able to install it.
  test("the iOS app requires iOS 16 in the Podfile and every configuration", () => {
    expect(read("../ios/App/Podfile")).toMatch(/^platform :ios, '16\.0'$/m);
    const targets = [
      ...read("../ios/App/App.xcodeproj/project.pbxproj").matchAll(
        /IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g,
      ),
    ].map((match) => match[1]);
    expect(targets).toEqual(["16.0", "16.0", "16.0", "16.0"]);
  });

  // The iOS app runs the bundle in the WebKit of the installed iOS, so the
  // native build must lower syntax and keep CSS fallbacks down to the
  // deployment target; the web build targets current browsers only.
  test("the native build targets the WebKit of the iOS deployment target", () => {
    const ios = /^platform :ios, '(\d+)\.0'$/m.exec(
      read("../ios/App/Podfile"),
    )?.[1];
    expect(ios).toBeDefined();
    expect(safariTargets("native")).toEqual([`safari${ios}`]);

    const web = safariTargets("production");
    expect(web).toHaveLength(1);
    expect(Number.parseFloat(web[0].slice("safari".length))).toBeGreaterThan(
      Number(ios),
    );
  });
});
