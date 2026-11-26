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

  // The apps run the bundle in the platform WebView. iOS's is the WebKit of
  // the installed iOS and Safari N ships with iOS N. The target names the
  // current major of each browser, for Safari the major's first release, and
  // the deployment target is that iOS: not below it, which would run the
  // bundle on an older engine, and not a later point release, which would shut
  // out a phone one update behind. Android System WebView needs a
  // minimum API level that rises with Chromium; the table is what Chromium's
  // build/config/android/config.gni sets as default_min_sdk_version at the
  // release tag. A device below either minimum would install the app and then
  // run a bundle built for a newer engine.
  const webViewMinSdk: Array<[chrome: number, minSdk: number]> = [[158, 29]];

  const targetVersion = (browser: string) => {
    const targets = [buildConfig("native").build?.target ?? []].flat();
    const found = (targets as string[]).filter((target) =>
      target.startsWith(browser),
    );
    expect(found).toHaveLength(1);
    return found[0].slice(browser.length);
  };

  /** Whether dotted version a is at least b, comparing each part as a number. */
  const atLeast = (a: string, b: string) => {
    const [x, y] = [a, b].map((v) => v.split(".").map(Number));
    for (let i = 0; i < Math.max(x.length, y.length); i++)
      if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
    return true;
  };

  test("the web and native builds share one browser target", () => {
    expect(buildConfig("native").build?.target).toEqual(
      buildConfig("production").build?.target,
    );
  });

  test("the iOS deployment target ships the targeted Safari", () => {
    const podfile = /^platform :ios, '(\d+\.\d+)'$/m.exec(
      read("../ios/App/Podfile"),
    )?.[1];
    expect(podfile).toBeDefined();
    const configurations = [
      ...read("../ios/App/App.xcodeproj/project.pbxproj").matchAll(
        /IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g,
      ),
    ].map((match) => match[1]);
    expect(configurations).toEqual([podfile, podfile, podfile, podfile]);
    const safari = targetVersion("safari");
    const ios = targetVersion("ios");
    expect(safari).toMatch(/^\d+$/);
    expect(ios).toBe(safari);
    expect(atLeast(podfile ?? "0", ios)).toBe(true);
    expect(podfile).toBe(`${ios}.0`);
  });

  test("the Android minimum SDK runs the targeted Chrome's WebView", () => {
    // A row for exactly the targeted Chrome, so raising the target fails here
    // until someone reads that release's config.gni and adds its row.
    const chrome = Number(targetVersion("chrome"));
    const row = webViewMinSdk.find(([release]) => release === chrome);
    expect(row).toBeDefined();
    const required = row?.[1] ?? Infinity;
    const minSdk = Number(
      /^\s*minSdkVersion = (\d+)$/m.exec(
        read("../android/variables.gradle"),
      )?.[1],
    );
    expect(minSdk).toBeGreaterThanOrEqual(required);
  });
});

// Apps built with the iOS 27 SDK must adopt the scene-based life cycle or they
// fail to launch ("Application failed to launch: UIScene life cycle is
// required for apps built with this SDK" on the iOS 27.0 simulator). The shape
// is Capacitor 8.6.3's iOS template: a scene manifest, a SceneDelegate that
// hosts CAPBridgeViewController and forwards URL opens and user activities
// (universal links) to SceneDelegateProxy, and an AppDelegate that names it.
describe("iOS scene life cycle", () => {
  test("Info.plist declares one scene served by SceneDelegate", () => {
    const plist = read("../ios/App/App/Info.plist");
    const manifest =
      /<key>UIApplicationSceneManifest<\/key>\s*<dict>([\s\S]*?)<\/array>/.exec(
        plist,
      )?.[1];
    expect(manifest).toBeDefined();
    expect(manifest).toMatch(
      /<key>UIApplicationSupportsMultipleScenes<\/key>\s*<false\/>/,
    );
    expect(manifest).toMatch(
      /<key>UISceneConfigurationName<\/key>\s*<string>Default Configuration<\/string>/,
    );
    expect(manifest).toMatch(
      /<key>UISceneDelegateClassName<\/key>\s*<string>\$\(PRODUCT_MODULE_NAME\)\.SceneDelegate<\/string>/,
    );
  });

  test("SceneDelegate hosts the bridge and forwards links to Capacitor", () => {
    const scene = read("../ios/App/App/SceneDelegate.swift");
    expect(scene).toContain(
      "class SceneDelegate: UIResponder, UIWindowSceneDelegate",
    );
    expect(scene).toContain(
      "window?.rootViewController = CAPBridgeViewController()",
    );
    for (const forward of [
      "SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)",
      "SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)",
      "SceneDelegateProxy.shared.scene(scene, continue: userActivity)",
    ])
      expect(scene).toContain(forward);
  });

  test("AppDelegate names the scene configuration and never unwraps its own window", () => {
    const app = read("../ios/App/App/AppDelegate.swift");
    expect(app).toContain(
      'UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)',
    );
    expect(app).toContain("config.delegateClass = SceneDelegate.self");
    // Under scenes self.window is nil; the orientation hook reads the window
    // UIKit passes in.
    expect(app).not.toContain("self.window!");
    expect(app).toContain(
      "window?.rootViewController as? CAPBridgeViewController",
    );
  });

  test("SceneDelegate.swift is compiled into the App target", () => {
    const project = read("../ios/App/App.xcodeproj/project.pbxproj");
    const reference =
      /(\w{24}) \/\* SceneDelegate\.swift \*\/ = \{isa = PBXFileReference;[^}]*path = SceneDelegate\.swift;/.exec(
        project,
      )?.[1];
    expect(reference).toBeDefined();
    const buildFile = new RegExp(
      `(\\w{24}) /\\* SceneDelegate\\.swift in Sources \\*/ = \\{isa = PBXBuildFile; fileRef = ${reference} `,
    ).exec(project)?.[1];
    expect(buildFile).toBeDefined();
    const sources =
      /\/\* Sources \*\/ = \{\s*isa = PBXSourcesBuildPhase;[\s\S]*?files = \(([^)]*)\)/.exec(
        project,
      )?.[1] ?? "";
    expect(sources).toContain(
      `${buildFile} /* SceneDelegate.swift in Sources */`,
    );
  });
});
