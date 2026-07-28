/// <reference types="@capacitor-community/safe-area" />
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.p2party.app",
  appName: "P2Party",
  webDir: "dist",
  ios: {
    contentInset: "always",
  },
  plugins: {
    // @capacitor-community/safe-area installs its own window-insets listener
    // on the decor view and already pads for the keyboard. Capacitor core's
    // SystemBars listener pads the WebView's parent for the SAME keyboard, and
    // because they sit on different views the two paddings nest instead of
    // replacing each other -- the WebView ends up shrunk by about twice the
    // keyboard height. The safe-area plugin detects this and logs that this
    // setting is required; it defaults to "css" (enabled), so it must be
    // disabled explicitly. Exactly one layer may own the insets.
    SystemBars: {
      insetsHandling: "disable",
    },
    // SafeArea: {
    //   enabled: true,
    //   customColorsForSystemBars: true,
    //   // statusBarColor: '#000000',
    //   // statusBarContent: 'light',
    //   // navigationBarColor: '#000000',
    //   // navigationBarContent: 'light',
    // },
    ScreenOrientation: {
      orientation: "portrait",
    },
    StatusBar: {
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
