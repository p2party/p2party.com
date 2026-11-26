# Native builds

The Android and iOS apps are Capacitor 8 shells around the web client
(`webDir: "dist"` in `capacitor.config.ts`). A passing native build is not a
mobile release: neither app has been run on a device, emulator or simulator
here, and release signing is not set up in the repository.

## Toolchain

- **Capacitor:** 8.4.2 for the CLI, core, Android and iOS packages.
- **Android:** Gradle wrapper 8.14.3, Android Gradle Plugin 8.13.0, compile
  and target SDK 36, minimum SDK 24. The plugins compile with a Java 21
  toolchain. Gradle does not find Homebrew's keg-only `openjdk@21` by itself,
  and with only a newer JDK on the path the build stops at "Cannot find a Java
  installation on your machine (...) matching: {languageVersion=21, ...}".
  Point `JAVA_HOME` at a JDK 21:

  ```sh
  cd android
  JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
    ./gradlew assembleDebug
  ```

- **iOS:** deployment target 16.0 (`ios/App/Podfile` and every configuration
  in `App.xcodeproj`; see the policy section for why), dependencies through
  CocoaPods (`Podfile.lock` was written by 1.17.0). Build the workspace, not
  the project:

  ```sh
  cd ios/App
  xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    CODE_SIGNING_ALLOWED=NO build
  ```

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
Content-Security-Policy (below). `cap sync` also rewrites
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
so the app would install and then fail to run any cryptography. The iOS
deployment target is therefore 16.0: devices that cannot run iOS 16 cannot
install the app; the web app is unaffected. That `'wasm-unsafe-eval'` first
shipped in Safari and iOS 16 is unverified here: no compatibility data or
WebKit release notes are available offline, and no iOS 15 runtime is
installed.

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

On 2026-11-26 it fails at the room dialog, and not because of the policy: the
rooms page throws `TypeError: WASM source must use http: or https:`.
`src/protocol/sdk.ts` points the SDK at `/vendor/.../libcrypto.wasm` relative
to the page, which on iOS is a `capacitor:` URL, and p2party 0.14.10's
`setWasmSourceUrl` accepts only `http:` and `https:`. The same error appears
with the policy removed. It is thrown when `sdk.ts` loads, so every route that
imports it is affected on iOS. The home page and the local crypto proof (which
passes its WASM bytes directly) work, with no violations.

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
- Neither platform reports when a viewer is done with a file: the iOS preview
  resolves when it is shown and the Android intent when it is started. So the
  folder is removed at every app start and by every purge (identity, room and
  everything), not after use.
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
apps reads it. On Android, Cordova 14's `AllowListPlugin` parses the element,
but only Cordova's own WebView classes (`CordovaWebViewImpl`,
`SystemWebViewClient`, `CordovaBridge`) ask it, and Capacitor replaces those
with its own bridge; no Cordova plugin is installed. On iOS, `CDVConfigParser`
does not read `<access>`. `capacitor.config.ts` therefore sets an empty list,
and the generated file has no `<access>` element.

## Last verified: 2026-11-26

- **Android:** `./gradlew clean assembleDebug` with JDK 21.0.13 succeeded on a
  `build:native` copy. With the copy's SDK path changed to 0.14.4, and with a
  `build:client` copy, the build failed in `checkBundledWebClient`; after
  `build:native` and `cap sync android` it passed. Not installed on a device or
  emulator.
- **iOS:** with the deployment target at 16.0, `pod install --deployment`
  succeeded, which confirms that `Podfile.lock` matches the `Podfile`. The
  unsigned simulator build succeeded with Xcode 27.2 on a `build:native` copy
  and failed in "Check bundled web client" for a `build:client` copy and for a
  copy loading 0.14.4. Not run on a simulator or device.
- **Policy:** `npm run e2e:native-csp` passed: zero violations, zero page
  errors, zero requests leaving loopback, WASM fetched and compiled. With
  `blob:` removed from `worker-src` it failed with a recorded `worker-src`
  violation on `/rooms`. `e2e/native-csp-webkit.swift` on macOS 27.2 WebKit:
  the home page rendered and the local crypto proof finished with no
  violation. It failed at the room dialog because of the SDK's WASM-source
  check described above. With `'wasm-unsafe-eval'` removed, both engines
  refused the WASM.
