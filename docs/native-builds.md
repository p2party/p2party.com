# Native builds

The Android and iOS apps are Capacitor 8 shells around the web client
(`webDir: "dist"` in `capacitor.config.ts`). A passing native build is not a
mobile release: neither app has been run on a device here (see "Last
verified" for the emulator and simulator runs), and release signing is not
set up in the repository.

## Toolchain

- **Capacitor:** 8.6.3 for the CLI, core, Android and iOS packages.
- **Android.** The project targets and compiles with API 37.0. Install SDK
  Platform 37.0 and Build Tools 36.0.0. The Gradle wrapper pins the SHA-256
  of the Gradle 9.9.2 binary distribution. The build uses Android Gradle
  Plugin 9.5.3, AndroidX Core 1.19.1, and the Cordova Android 15.1.0 framework.
  The minimum OS is Android 10 (API 29). The web client requires Android
  System WebView 158 or newer, which updates independently of Android.
  [Android Gradle Plugin compatibility](https://developer.android.com/build/releases/agp-9-5-0-release-notes)

  Capacitor 8.6.3's built-in SystemBars plugin owns the Android keyboard and
  safe-area insets. The app's light and dark window-background resources match
  the page behind the bars. On iOS, SystemBars sets the status-bar glyphs and
  StatusBar supplies the background above the web view.
  [Capacitor System Bars](https://capacitorjs.com/docs/apis/system-bars)

  On Android 17 and later, entering the first room requests local-network
  access through the Nearby devices dialog. Denial leaves internet routes
  available. A message in the room opens Android settings to change the
  permission. Returning from settings refreshes the message. Older Android
  versions enter rooms without this prompt. Before distributing an Android
  build, verify grant, denial, revocation and regrant on Android 17. Check
  direct delivery between two peers on one Wi-Fi network after grant and
  public TURN delivery after denial. Check the keyboard with the composer
  focused and the status-bar colors in both themes.
  [Android local-network permission](https://developer.android.com/privacy-and-security/local-network-permission)

  The plugins compile with a Java 21 toolchain. Gradle does not find Homebrew's
  keg-only `openjdk@21` by itself, and with only a newer JDK on the path the
  build stops at "Cannot find a Java installation on your machine (...)
  matching: {languageVersion=21, ...}". Point `JAVA_HOME` at a JDK 21:

  ```sh
  cd android
  JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
    ./gradlew assembleDebug
  ```

- **iOS:** deployment target 27.0 (`ios/App/Podfile` and every configuration
  in `App.xcodeproj`). The minimum follows the browser target, Safari 27:
  Apple's Safari 27 release notes say "Safari 27 is available for iOS 27,
  iPadOS 27, visionOS 27, macOS 27, macOS 26, and macOS Sequoia". Apple lists
  iOS 27 for iPhone 11 and later and iPhone SE (2nd generation and later), and
  iPadOS 27 for iPad Pro (4th generation and later), iPad Air (4th generation
  and later), iPad (9th generation and later) and iPad mini (6th generation
  and later). Dependencies through CocoaPods (`Podfile.lock` was written by
  1.17.0); the pods keep their own minimum of iOS 15.0. Build the workspace,
  not the project:

  ```sh
  cd ios/App
  xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    CODE_SIGNING_ALLOWED=NO build
  ```

- **Status bar:** `applySystemBarTheme` (`src/protocol/systemBars.ts`), run
  by `App.tsx` at start-up and whenever the page's theme changes, is the one
  place that styles the bars. The theme follows the system appearance
  (`prefers-color-scheme`); the app has no theme switch of its own. On both
  platforms `SystemBars.setStyle` selects dark glyphs on the light theme and
  light glyphs on the dark theme. On Android it paints the window behind the
  bars with the current day/night window-background resource. On iOS the web view sits below
  the status bar (`StatusBar.overlaysWebView: false`), so page content never
  scrolls under the clock or the Dynamic Island, and the StatusBar plugin
  fills the bar with a view of its own, black by default;
  `StatusBar.setBackgroundColor` paints it the page's background (`#ffffff`
  or `#000000`, from `bg-white` and `dark:bg-black` on `<html>`). Until that
  first call the band has the plugin's default colour, black. Earlier code
  called `StatusBar.setStyle` and then `SafeArea.setSystemBarsStyle`; on iOS
  the second undid the first, and nothing coloured the band, which left black
  glyphs on a black band in light mode. `tests/systemBars.test.ts` checks one
  glyph call per theme and platform, the band colour on iOS, and the
  Capacitor settings this relies on.
- **iOS scene life cycle:** the app uses UIKit's scene-based life cycle.
  Apple's iOS & iPadOS 27 release notes (Deprecations, 141837548): "Apps built
  with the latest SDK must adopt the scene-based life cycle or they fail to
  launch", with migration guidance in TN3187, "Migrating to the UIKit
  scene-based life cycle". Built with the iOS 27.2 SDK and no scene manifest,
  the app was refused on the iOS 27.0 simulator: "Application failed to launch:
  UIScene life cycle is required for apps built with this SDK", and the process
  exited with SIGTRAP. The project now has what `@capacitor/cli` 8.6.3's iOS
  template and its UIScene migration produce: a `UIApplicationSceneManifest` in
  `Info.plist` (one scene, `$(PRODUCT_MODULE_NAME).SceneDelegate`, the `Main`
  storyboard), `SceneDelegate.swift` in the App target, which hosts
  `CAPBridgeViewController` and forwards the connection options, URL opens and
  user activities (universal links) to Capacitor's `SceneDelegateProxy`, and
  `application(_:configurationForConnecting:options:)` in `AppDelegate.swift`.
  The AppDelegate's orientation hook for `@capacitor/screen-orientation` reads
  the window UIKit passes in, as the plugin's README requires under scenes,
  because `self.window` is now nil. `tests/nativeBuild.test.ts` pins all four
  parts.

## Refresh the bundled web client

Each native project packages its own copy of `dist/`
(`android/app/src/main/assets/public` and `ios/App/App/public`). Git ignores
both copies, so a checkout or a pull does not update them. Before every native
build:

```sh
npm run build:native
npx cap sync android   # or: npx cap sync ios
```

`build:native` is `vite build --mode native`: the web client plus the app's
Content-Security-Policy (below). Both builds use one browser target,
`BROWSER_TARGET` in `vite.config.ts`: the current major of each browser, for
Safari the major's first release because the iOS deployment target follows it
(Chrome and Edge 158, Firefox 161, Safari 27, and iOS 27 listed beside
Safari as Vite's own default does), with nothing lowered, prefixed or given a
fallback for older engines. The apps' minimums follow from it (see Toolchain).
`tests/nativeBuild.test.ts` fails if the iOS entry is not the Safari major, if
the `Podfile` or any Xcode configuration is not that iOS major's .0 release,
if the targeted Chrome has no row in its WebView minimum-SDK table, or if
`minSdkVersion` falls below what the targeted Chrome's WebView needs.
`cap sync` also rewrites
`android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle`, the
plugin list in `ios/App/Podfile` and the generated `config.xml` files, and runs
`pod install`. When no plugin was added or removed the tracked files come out
unchanged; review any diff they show.

Both builds refuse a stale copy. A Gradle task (`checkBundledWebClient`, run
before `preBuild`) and an Xcode run-script phase ("Check bundled web client",
before Resources) read the SDK version from `package.json`
(`file:vendor/p2party-<version>.tgz`), collect every `vendor/p2party-<version>/`
path the copied scripts load, and fail unless that is exactly the vendored
version. They also fail when the copied `index.html` has no
Content-Security-Policy meta element, which is what a `build:client` copy looks
like. The message names the fix:

```text
The bundled web client loads p2party 0.14.4, but package.json vendors 0.14.10.
Run `npm run build:native && npx cap sync android`, then build again.
```

## Content-Security-Policy

The web policy is a response header set at the CDN (see
[Deployment](deployment.md)). The apps load their pages from
`https://localhost` (Android) and `capacitor://localhost` (iOS), which have no
headers to carry one, so the native build puts the policy in a meta element at
the top of `<head>`. `vite.config.ts` reads it from the
`Content-Security-Policy:` line of `docs/deployment.md`, so the two cannot
drift, and changes it in two ways only:

- `frame-ancestors` is dropped. Browsers ignore it in a meta element and log an
  error.
- `capacitor://localhost` is added wherever the web policy allows `'self'`.
  `capacitor:` is not a special URL scheme, so under the URL standard its
  origin is opaque and `'self'` is not guaranteed to match it. Current WebKit
  does match it (below); the explicit origin covers WebKit versions that were
  not tested.

Capacitor's own bridge needs no source: Android injects it with
`addDocumentStartJavaScript`, or, on WebViews without that feature, as an
inline script inserted directly after `<head>`, ahead of the meta element and
therefore outside the policy; iOS injects it as a `WKUserScript`.

The cryptography module is WebAssembly, which the policy allows through
`'wasm-unsafe-eval'` only. A WebKit without that keyword refuses to compile it,
so the app would install and then fail to run any cryptography. MDN's
browser-compat-data lists the keyword from Safari 16 and Android WebView 97,
far below the minimums the browser target sets.

### Checking the policy

Run `npm run e2e:native-csp` after any change to the policy in
`docs/deployment.md`, to `vite.config.ts`, or to the vendored SDK version. It
builds with `build:native`, serves `dist/` the way Capacitor does (the file if
it exists, otherwise `index.html`) on `127.0.0.1:5847`, and drives headless
Chromium with a `securitypolicyviolation` listener. It loads the home page,
opens the "New room" dialog, loads an invitation without connecting, and runs
the session lab's local crypto proof, which fetches and compiles the WASM. It
fails on any violation, page error, or request that leaves loopback. The report
goes to `logs/native-csp/result.json`.

`e2e/native-csp-webkit.swift` is the same check in WebKit under the
`capacitor://` scheme, run by hand on macOS with Xcode's command-line tools
after `npx cap sync ios`:

```sh
swift e2e/native-csp-webkit.swift ios/App/App/public
```

### Loading the SDK's WASM in iOS

The iOS app serves the WASM from `capacitor://localhost/vendor/.../libcrypto.wasm`.
The vendored SDK candidate accepts the page's own scheme and host and checks
the integrity of the fetched bytes. The earlier 0.14.10 SDK rejected this URL
in `setWasmSourceUrl` when the rooms page loaded. The WebKit check covers the
room dialog and local crypto proof under the app's custom scheme.

On 2026-11-27, the WebKit check opened the room dialog and completed the
local crypto proof with the 0.15.0-rc.0 candidate on `capacitor://localhost`.
Chromium also rendered the invitation and fetched the self-hosted WASM. Both
checks recorded zero CSP violations or page errors.

## Received attachments and the room QR code

- "Download file" on Android and iOS, and "Download QR" in the share dialog,
  hand a file to the operating system's opener only when its MIME type is in
  `OPENABLE_TYPES` (`src/protocol/attachmentOpen.ts`): PNG, JPEG, GIF, WebP,
  AVIF, BMP, PDF, and the SDK's audio and video types. The type is passed to
  the opener explicitly, so Android does not infer it from a file name. Any
  other type is not written and shows "This file type cannot be opened on this
  device." The web build uses the same list to decide what may open in a tab.
- The copy is written to `p2party-attachments/` in Capacitor's cache directory,
  which neither platform backs up, under a name the app builds: a random
  token, then the last component of the sender's file name without its
  extension, reduced to letters, digits, `_` and `-` and cut to 64 characters,
  then the extension of the allowlisted type. The app's FileProvider already
  shares the cache directory (`cache-path` in `file_paths.xml`); it does not
  share `Directory.Data`, which the earlier code wrote to.
- The installed opener does not tell the app when a viewer is done with a
  file. iOS reports the preview closing to the plugin
  (`UIDocumentInteractionController`'s delegate), but the plugin does not
  forward it; on Android the plugin starts the intent without asking for a
  result, and its call resolves at once. So the folder is removed at every app
  start and by every purge (identity, room and everything), not after use. The
  startup removal runs in the background: a file opened in the first moments
  after a start could be removed with the rest.
- Earlier builds wrote decrypted copies to `Directory.Data` (iOS Documents,
  Android `files/`) as `<13-digit milliseconds>-<name>.<extension>`, with the
  extension one of p2party 0.14.10's file extensions or empty, and saved the
  room QR code as `p2party/room-invite.png` in `Directory.Documents`. Each
  start also deletes those: the top-level `Directory.Data` files whose names
  match that pattern exactly, the QR file, and its `p2party` folder if nothing
  else is in it. Nothing else is touched. A step that fails is logged and the
  start continues. Listing `Directory.Data` uses an empty path; on an Android
  emulator it returned an empty list, and it has not run on a device.
- On iOS the file opens in the system preview (`UIDocumentInteractionController`),
  whose share sheet offers Save to Files and, for images, Save Image. That is
  standard iOS behaviour and was not exercised here.
  `NSPhotoLibraryAddUsageDescription` explains the Save Image case; iOS
  requires it before an app adds to the photo library. The `Info.plist` does not declare `UIFileSharingEnabled` or
  `LSSupportsOpeningDocumentsInPlace`, so the app's Documents directory is not
  listed in the Files app or in Finder. On Android, saving the QR code depends
  on the viewer app the intent opens.

## Cordova `config.xml`

`cap sync` writes `config.xml` for Cordova plugins and adds
`<access origin="*"/>` unless `cordova.accessOrigins` is set. Nothing in these
apps reads it. On Android, Cordova 15's `AllowListPlugin` parses the element,
but only Cordova's own WebView classes (`CordovaWebViewImpl`,
`SystemWebViewClient`, `CordovaBridge`) ask it, and Capacitor replaces those
with its own bridge; no Cordova plugin is installed. On iOS, `CDVConfigParser`
does not read `<access>`. `capacitor.config.ts` therefore sets an empty list,
and the generated file has no `<access>` element.

## Last verified: 2026-11-26

- **Earlier Android build.** Gradle 9.5.1, AGP 8.13.2, compile and target
  SDK 36, and JDK 21.0.13 passed `./gradlew clean assembleDebug` with a
  `build:native` copy, and `checkBundledWebClient` failed for a `build:client`
  copy and passed after `build:native` and `cap sync`. Installed and launched
  on an Android 16 (API 36) emulator with WebView 133.0.6943.137: the process
  stayed up and the home page rendered; the only console errors were the
  startup sweep's removals of files a fresh install does not have, and
  listing `Directory.Data` with an empty path returned an empty list. Not run
  on a device.
- **iOS:** with the deployment target at 27.0 and Capacitor 8.6.3,
  `pod install --deployment` succeeded, which confirms that `Podfile.lock`
  matches the `Podfile`, and the unsigned simulator build succeeded with Xcode
  27.2 on a `build:native` copy, with the "Check bundled web client" phase
  passing; `tests/nativeBuild.test.ts` also runs that phase against fixture
  bundles. On the iOS 27.0 simulator (iPhone 17) the app launched, stayed
  running for at least 30 seconds and showed the home page, loaded from
  `capacitor://localhost`; the console showed no Content-Security-Policy
  refusal, only the startup sweep's removals of files a fresh install does not
  have. Those first screenshots also showed a black band behind the status bar
  with the clock and icons invisible on it in light mode (black on black; see
  "Status bar" below). After that fix, in light and in dark appearance, at
  launch and when the appearance was switched with the app open, the band is
  the page's background (white or black) and the clock and icons contrast
  with it; the page starts below the band. Not run on a device.
- **Policy:** on the Vite 8 build, `npm run e2e:native-csp` passed: zero
  violations, zero page errors, zero requests leaving loopback, WASM fetched
  and compiled. `e2e/native-csp-webkit.swift` on macOS 27.2 WebKit: the home
  page rendered and the local crypto proof finished with no violation. It
  failed at the room dialog because of the SDK's WASM-source check described
  above. In the earlier run on the Vite 7 build, the same two checks gave the
  same results; with `blob:` removed from `worker-src` the Chromium check
  failed with a recorded `worker-src` violation on `/rooms`, and with
  `'wasm-unsafe-eval'` removed both engines refused the WASM.
