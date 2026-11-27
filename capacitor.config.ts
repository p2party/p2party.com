import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.p2party.app",
  appName: "P2Party",
  webDir: "dist",
  ios: {
    contentInset: "always",
  },
  // `cap sync` writes config.xml for Cordova plugins and adds a wildcard
  // <access origin="*"/> unless this list is given. Nothing here reads it: on
  // Android only Cordova's own WebView stack consults the allow-list, and
  // Capacitor replaces that stack; iOS's CDVConfigParser ignores <access>. No
  // Cordova plugin is installed. An empty list writes no <access> at all.
  cordova: {
    accessOrigins: [],
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
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
