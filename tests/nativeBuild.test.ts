import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

import viteConfig, {
  documentedWebPolicy,
  nativeContentSecurityPolicy,
} from "../vite.config";
import capacitorConfig from "../capacitor.config";

import type { HtmlTagDescriptor, Plugin, UserConfig } from "vite";

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

const directives = (policy: string) =>
  new Map(
    policy
      .split(";")
      .map((directive) => directive.trim().split(/\s+/))
      .filter((parts) => parts[0].length > 0)
      .map(([name, ...sources]) => [name, sources]),
  );

const nativeMetaTags = async (mode: string) => {
  const config = (
    viteConfig as (env: {
      command: "build";
      mode: string;
      isSsrBuild: boolean;
      isPreview: boolean;
    }) => UserConfig
  )({ command: "build", mode, isSsrBuild: false, isPreview: false });
  const plugin = (config.plugins as Plugin[]).find(
    (candidate) => candidate.name === "native-content-security-policy",
  );
  const transform = plugin?.transformIndexHtml as () =>
    HtmlTagDescriptor[] | Promise<HtmlTagDescriptor[]>;
  return await transform();
};

describe("native Content-Security-Policy", () => {
  test("is the documented web policy plus the iOS app origin", () => {
    const web = directives(documentedWebPolicy(read("../docs/deployment.md")));
    const native = directives(
      nativeContentSecurityPolicy(
        documentedWebPolicy(read("../docs/deployment.md")),
      ),
    );

    // A meta element cannot deliver frame-ancestors; everything else stays.
    expect(web.has("frame-ancestors")).toBe(true);
    expect(native.has("frame-ancestors")).toBe(false);
    expect([...native.keys()]).toEqual(
      [...web.keys()].filter((name) => name !== "frame-ancestors"),
    );
    for (const [name, sources] of native) {
      const webSources = web.get(name) ?? [];
      const expected = webSources.includes("'self'")
        ? [...webSources, "capacitor://localhost"]
        : webSources;
      expect(sources).toEqual(expected);
    }
    expect(native.get("script-src")).not.toContain("'unsafe-eval'");
    expect(native.get("script-src")).not.toContain("'unsafe-inline'");
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
});
