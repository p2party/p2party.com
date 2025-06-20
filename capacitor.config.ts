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
