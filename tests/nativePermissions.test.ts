import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

// The composer renders MicrophoneButton, which calls
// getUserMedia({ audio: true }). On the native shells that call is gated by the
// platform manifests, not by the web permission prompt: Android's WebChromeClient
// cannot grant a permission the app never declared, and iOS terminates the
// process the first time the microphone is touched without a usage string.
// Neither failure shows up in a browser, so pin both declarations here.
const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

describe("native microphone permissions", () => {
  // Capacitor 8's BridgeWebChromeClient.onPermissionRequest asks the activity
  // for MODIFY_AUDIO_SETTINGS *and* RECORD_AUDIO together, and its callback
  // grants the WebView request only if every permission in that batch comes
  // back true. Android reports an undeclared permission as denied without
  // prompting, so omitting either one denies the microphone even after the
  // user taps Allow. Both have to be declared, and no bundled library
  // declares them for us.
  test.each([
    "android.permission.INTERNET",
    "android.permission.RECORD_AUDIO",
    "android.permission.MODIFY_AUDIO_SETTINGS",
  ])("the Android manifest declares %s", (permission) => {
    expect(read("../android/app/src/main/AndroidManifest.xml")).toContain(
      `<uses-permission android:name="${permission}" />`,
    );
  });

  test("the iOS Info.plist carries a microphone usage string", () => {
    const plist = read("../ios/App/App/Info.plist");
    const usage = plist.match(
      /<key>NSMicrophoneUsageDescription<\/key>\s*<string>([^<]*)<\/string>/,
    );

    expect(usage).not.toBeNull();
    expect(usage?.[1].trim().length).toBeGreaterThan(0);
  });
});
