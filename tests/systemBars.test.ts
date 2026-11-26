import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

import capacitorConfig from "../capacitor.config";
import {
  SYSTEM_BAR_BACKGROUND,
  applySystemBarTheme,
} from "../src/protocol/systemBars";

import type { SystemBarPlugins } from "../src/protocol/systemBars";

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

type Glyphs = "light glyphs" | "dark glyphs";

/**
 * Both plugins stubbed, recording every call that sets the glyph style or the
 * bar's background, in order. StatusBar.setStyle is stubbed too, so a call to
 * it would be seen even though the code under test must not make one.
 */
const recordingPlugins = () => {
  const glyphCalls: Array<{ plugin: string; glyphs: Glyphs }> = [];
  const backgrounds: string[] = [];
  const plugins = {
    safeArea: {
      setSystemBarsStyle: async ({ style }: { style: string }) => {
        // SafeAreaPlugin: DARK -> .lightContent, LIGHT -> .darkContent.
        glyphCalls.push({
          plugin: "SafeArea",
          glyphs: style === "DARK" ? "light glyphs" : "dark glyphs",
        });
      },
    },
    statusBar: {
      setBackgroundColor: async ({ color }: { color: string }) => {
        backgrounds.push(color);
      },
      setStyle: async ({ style }: { style: string }) => {
        // StatusBar: Style.Dark -> .lightContent, Style.Light -> .darkContent.
        glyphCalls.push({
          plugin: "StatusBar",
          glyphs: style === "DARK" ? "light glyphs" : "dark glyphs",
        });
      },
    },
  };
  return {
    plugins: plugins as unknown as SystemBarPlugins,
    glyphCalls,
    backgrounds,
  };
};

describe("status bar theme", () => {
  test.each([
    ["ios", false, "dark glyphs", [SYSTEM_BAR_BACKGROUND.light]],
    ["ios", true, "light glyphs", [SYSTEM_BAR_BACKGROUND.dark]],
    ["android", false, "dark glyphs", []],
    ["android", true, "light glyphs", []],
  ] as const)(
    "%s, dark mode %p: one glyph style, %s, on the page's background",
    async (platform, isDarkMode, glyphs, background) => {
      const { plugins, glyphCalls, backgrounds } = recordingPlugins();
      await applySystemBarTheme(platform, isDarkMode, plugins);
      // One caller decides the glyphs, so nothing later can contradict it.
      expect(glyphCalls).toEqual([{ plugin: "SafeArea", glyphs }]);
      // iOS draws the bar's background itself; on Android SafeArea paints the
      // window behind the bars, and StatusBar.setBackgroundColor would pick a
      // style of its own on Android 14 and earlier.
      expect(backgrounds).toEqual([...background]);
    },
  );

  test("a theme change while the app is open restyles the bar", async () => {
    const { plugins, glyphCalls, backgrounds } = recordingPlugins();
    await applySystemBarTheme("ios", false, plugins);
    await applySystemBarTheme("ios", true, plugins);
    expect(glyphCalls.at(-1)).toEqual({
      plugin: "SafeArea",
      glyphs: "light glyphs",
    });
    expect(backgrounds.at(-1)).toBe(SYSTEM_BAR_BACKGROUND.dark);
  });

  test("the web build touches neither plugin", async () => {
    const { plugins, glyphCalls, backgrounds } = recordingPlugins();
    await applySystemBarTheme("web", false, plugins);
    expect(glyphCalls).toEqual([]);
    expect(backgrounds).toEqual([]);
  });

  test("the bar's background is the page's background", () => {
    const html = /<html\s+[^>]*class="([^"]*)"/.exec(
      read("../index.html"),
    )?.[1];
    const classes = (html ?? "").split(/\s+/);
    expect(classes).toContain("bg-white");
    expect(classes).toContain("dark:bg-black");
    expect(SYSTEM_BAR_BACKGROUND).toEqual({
      light: "#ffffff",
      dark: "#000000",
    });
  });

  test("the app styles the bar only through applySystemBarTheme", () => {
    const app = read("../src/App.tsx");
    expect(app).toContain(
      "applySystemBarTheme(Capacitor.getPlatform(), isDarkMode",
    );
    expect(app).not.toMatch(/StatusBar\.setStyle\(/);
    expect(app).not.toMatch(/SafeArea\.setSystemBarsStyle\(/);
    expect(app).not.toMatch(/StatusBar\.setBackgroundColor\(/);
  });

  test("Capacitor keeps the iOS web view below the bar and sets no style at load", () => {
    const plugins = capacitorConfig.plugins ?? {};
    expect(plugins.StatusBar?.overlaysWebView).toBe(false);
    // A style here would be applied natively at load and could contradict the
    // one applySystemBarTheme asks for.
    expect(plugins.StatusBar?.style).toBeUndefined();
    expect(plugins.SafeArea?.statusBarStyle).toBeUndefined();
  });
});
