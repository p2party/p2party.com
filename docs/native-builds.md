# Native builds

The Android and iOS apps are Capacitor 8 shells around the web client
(`webDir: "dist"` in `capacitor.config.ts`). A passing native build is not a
mobile release: neither project has been run on a device here, and release
signing is not set up in the repository.

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

- **iOS:** deployment target 15.0, dependencies through CocoaPods
  (`Podfile.lock` was written by 1.17.0). Build the workspace, not the project:

  ```sh
  cd ios/App
  xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    CODE_SIGNING_ALLOWED=NO build
  ```

## Refresh the bundled web client

Each native project packages its own copy of `dist/`
(`android/app/src/main/assets/public` and `ios/App/App/public`). Git ignores
both copies, so a checkout or a pull does not update them, and a native build
packages whatever was synced last. Before every native build:

```sh
npm run build:client
npx cap sync android   # or: npx cap sync ios
```

`cap sync` also rewrites `android/capacitor.settings.gradle`,
`android/app/capacitor.build.gradle` and the plugin list in `ios/App/Podfile`,
and runs `pod install`. When no plugin was added or removed these files come
out unchanged; review any diff they show.

`public/vendor/` keeps several SDK versions, so check which one the copied
bundle loads. It must be the version `package.json` names:

```sh
grep -o 'vendor/p2party-[0-9.]*' -r android/app/src/main/assets/public/assets | sort -u
grep -o 'vendor/p2party-[0-9.]*' -r ios/App/App/public/assets | sort -u
```

## Received attachments

- "Download file" on Android and iOS hands a file to the operating system's
  opener only when its MIME type is in `OPENABLE_MIME_TYPES`
  (`src/protocol/attachmentOpen.ts`): PNG, JPEG, GIF, WebP, AVIF, BMP, PDF,
  audio and video. The type is passed to the opener explicitly, so Android does
  not infer it from the sender's file name. Any other type is not written and
  shows "This file type cannot be opened on this device." The web build uses
  the same list to decide what may open in a tab.
- The iOS `Info.plist` does not declare `UIFileSharingEnabled` or
  `LSSupportsOpeningDocumentsInPlace`, so the app's Documents directory is not
  listed in the Files app or in Finder. Opened attachments are still written to
  that directory (Capacitor's `Directory.Data` maps to it on iOS), are not
  deleted afterwards, and are included in device backups. The room QR code
  saved by the share dialog goes to the same directory and is no longer
  reachable from the Files app.

## Last verified: 2026-11-26

- **Android:** `./gradlew clean assembleDebug` with JDK 21.0.13 succeeded. The
  debug APK reports compile and target SDK 36 and loads
  `vendor/p2party-0.14.10`. Not installed on a device or emulator.
- **iOS:** `pod install --deployment` succeeded, which confirms that
  `Podfile.lock` matches the `Podfile`. `xcodebuild -list` lists the `App`
  scheme, and the unsigned simulator build above succeeded with Xcode 27.2.
  Not run on a simulator or device.
