import { readFileSync } from "node:fs";
import { describe, expect, mock, test } from "bun:test";

import {
  openAttachmentNatively,
  openableMimeType,
  type NativeFileShell,
} from "../src/protocol/attachmentOpen";

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

// On Android and iOS a received attachment is handed to the operating system's
// opener. The MIME type comes from the sender's message type, so a peer picks
// which application receives the file: an APK goes to the package installer,
// HTML and SVG to a browser. Only the types the web build renders inline may
// leave the app.
describe("native attachment opening", () => {
  const nativeShell = () => ({
    save: mock<NativeFileShell["save"]>((path) =>
      Promise.resolve(`file:///data/${path}`),
    ),
    open: mock<NativeFileShell["open"]>(() => Promise.resolve()),
  });

  test("only allowlisted MIME types open natively", async () => {
    const refused = [
      "application/vnd.android.package-archive",
      "application/vnd.microsoft.portable-executable",
      "application/x-apple-diskimage",
      "text/html",
      "image/svg+xml",
      "image/svg+xml; charset=utf-8",
      "application/javascript",
      "application/xml",
      "application/zip",
      "application/msword",
      "application/octet-stream",
      "application/pdf+xml",
      "",
    ];
    for (const type of refused) {
      const shell = nativeShell();
      const opening = openAttachmentNatively(
        new Blob(["x"], { type }),
        "1-file.bin",
        shell,
      );
      await expect(opening).rejects.toThrow(
        "This file type cannot be opened on this device.",
      );
      expect(shell.save).not.toHaveBeenCalled();
      expect(shell.open).not.toHaveBeenCalled();
    }

    const allowed: [string, string][] = [
      ["image/png", "image/png"],
      ["image/jpeg", "image/jpeg"],
      ["application/pdf", "application/pdf"],
      ["audio/mpeg", "audio/mpeg"],
      ["video/mp4", "video/mp4"],
      ["Video/QuickTime; codecs=avc1", "video/quicktime"],
    ];
    for (const [type, normalised] of allowed) {
      const shell = nativeShell();
      const blob = new Blob(["x"], { type });
      await openAttachmentNatively(blob, "1-photo.png", shell);
      expect(shell.save).toHaveBeenCalledTimes(1);
      expect(shell.save).toHaveBeenCalledWith("1-photo.png", blob);
      // The type is passed explicitly, so Android does not fall back to
      // guessing it from the file name the sender chose.
      expect(shell.open).toHaveBeenCalledTimes(1);
      expect(shell.open).toHaveBeenCalledWith(
        "file:///data/1-photo.png",
        normalised,
      );
    }
  });

  test("the web inline check and the native check share one allowlist", () => {
    expect(openableMimeType("image/webp")).toBe("image/webp");
    expect(openableMimeType(" IMAGE/GIF ")).toBe("image/gif");
    expect(openableMimeType("image/svg+xml")).toBeUndefined();
    expect(openableMimeType("text/html")).toBeUndefined();

    const dropdown = read("../src/components/MessageItem/MessageDropdown.tsx");
    expect(dropdown).toContain("openableMimeType(");
    expect(dropdown).toContain("openAttachmentNatively(");
    expect(dropdown).not.toMatch(/"image\/png"|"application\/pdf"/);
  });
});

// UIFileSharingEnabled publishes the app's Documents directory in the Files
// app and over Finder, and LSSupportsOpeningDocumentsInPlace lets other apps
// open those files in place. Received attachments are decrypted plaintext.
describe("iOS file sharing", () => {
  test.each(["UIFileSharingEnabled", "LSSupportsOpeningDocumentsInPlace"])(
    "Info.plist does not declare %s",
    (key) => {
      expect(read("../ios/App/App/Info.plist")).not.toContain(
        `<key>${key}</key>`,
      );
    },
  );
});
