import { SystemBarsStyle } from "@capacitor/core";

import type { SystemBars } from "@capacitor/core";
import type { StatusBarPlugin } from "@capacitor/status-bar";

/**
 * The page's background behind the status bar: `bg-white` and `dark:bg-black`
 * on `<html>` in index.html, which is what a phone shows.
 */
export const SYSTEM_BAR_BACKGROUND = {
  light: "#ffffff",
  dark: "#000000",
} as const;

export interface SystemBarPlugins {
  systemBars: Pick<typeof SystemBars, "setStyle">;
  statusBar: Pick<StatusBarPlugin, "setBackgroundColor">;
}

/**
 * Style the native status bar for the page's theme. Called at start-up and
 * whenever the theme changes.
 *
 * SystemBars is the only place that sets the glyph style: light glyphs on the
 * dark theme, dark glyphs on the light one, on both platforms. On Android it
 * also paints the window behind the bars in the same colour. On iOS the web
 * view sits below the status bar (`StatusBar.overlaysWebView: false` in
 * capacitor.config.ts, so content never scrolls under the clock or the
 * Dynamic Island), and the StatusBar plugin fills the bar with a view of its
 * own, black unless told otherwise; that view gets the page's background.
 * StatusBar's own style is never set: on iOS it would compete with SystemBars',
 * and on Android 14 and earlier setBackgroundColor would also pick a style.
 */
export const applySystemBarTheme = async (
  platform: string,
  isDarkMode: boolean,
  plugins: SystemBarPlugins,
): Promise<void> => {
  if (platform === "web") return;
  await plugins.systemBars.setStyle({
    style: isDarkMode ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  });
  if (platform === "ios")
    await plugins.statusBar.setBackgroundColor({
      color: isDarkMode
        ? SYSTEM_BAR_BACKGROUND.dark
        : SYSTEM_BAR_BACKGROUND.light,
    });
};
