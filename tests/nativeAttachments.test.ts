import { readFileSync } from "node:fs";
import { describe, expect, mock, test } from "bun:test";
import { Directory } from "@capacitor/filesystem";

import type { FilesystemPlugin } from "@capacitor/filesystem";
import type { FileOpenerPlugin } from "@capawesome-team/capacitor-file-opener";

import {
  LEGACY_ATTACHMENT_NAME,
  NATIVE_ATTACHMENT_FOLDER,
  nativeAttachmentName,
  openFileNatively,
  openableMimeType,
  removeNativeFileCopies,
  removeNativeFilesAtStartup,
} from "../src/protocol/attachmentOpen";

const emptyStorage = (): Storage => {
  const rows = new Map<string, string>();
  return {
    get length() {
      return rows.size;
    },
    clear: () => rows.clear(),
    getItem: (key) => rows.get(key) ?? null,
    key: (index) => [...rows.keys()][index] ?? null,
    removeItem: (key) => {
      rows.delete(key);
    },
    setItem: (key, value) => {
      rows.set(key, value);
    },
  };
};

// usePurge imports the SDK, which reads localStorage as it loads. Only when
// nothing has stubbed it already: bun runs every test file in one process.
if (!("localStorage" in globalThis))
  Object.defineProperty(globalThis, "localStorage", {
    value: emptyStorage(),
    configurable: true,
    writable: true,
  });
const { settlePurge } = await import("../src/hooks/usePurge");

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

/**
 * A device as the Filesystem and FileOpener plugins present it: files keyed
 * by directory and path, and the plugin's "does not exist" error code.
 */
const fakeDevice = (seed: Record<string, string> = {}) => {
  const files = new Map(Object.entries(seed));
  const key = (directory: Directory | undefined, path: string) =>
    `${String(directory)}/${path}`;
  const filesystem = {
    writeFile: mock<FilesystemPlugin["writeFile"]>(
      ({ path, data, directory }) => {
        files.set(key(directory, path), String(data));
        return Promise.resolve({ uri: `file:///${key(directory, path)}` });
      },
    ),
    getUri: mock<FilesystemPlugin["getUri"]>(({ path, directory }) =>
      Promise.resolve({ uri: `file:///${key(directory, path)}` }),
    ),
    rmdir: mock<FilesystemPlugin["rmdir"]>(({ path, directory }) => {
      const prefix = `${key(directory, path)}/`;
      const doomed = [...files.keys()].filter((name) =>
        name.startsWith(prefix),
      );
      if (doomed.length === 0)
        return Promise.reject(
          Object.assign(
            new Error(`'rmdir' failed because file does not exist.`),
            {
              code: "OS-PLUG-FILE-0008",
            },
          ),
        );
      for (const name of doomed) files.delete(name);
      return Promise.resolve();
    }),
  };
  const opener = {
    openFile: mock<FileOpenerPlugin["openFile"]>(() => Promise.resolve()),
  };
  return { files, filesystem, opener };
};

/**
 * A device with folders, for the startup sweep: paths are
 * `${directory}/${path}`. readdir lists one level, deleteFile removes a file,
 * and rmdir refuses a folder that is not empty unless asked to recurse.
 */
const deviceWithFolders = (files: string[], folders: string[] = []) => {
  const fileSet = new Set(files);
  const folderSet = new Set(folders);
  const notFound = () =>
    Object.assign(new Error("failed because file does not exist."), {
      code: "OS-PLUG-FILE-0008",
    });
  const inside = (folder: string) =>
    [...fileSet, ...folderSet].filter((path) => path.startsWith(`${folder}/`));
  const filesystem = {
    deleteFile: mock<FilesystemPlugin["deleteFile"]>(({ path, directory }) =>
      fileSet.delete(`${String(directory)}/${path}`)
        ? Promise.resolve()
        : Promise.reject(notFound()),
    ),
    rmdir: mock<FilesystemPlugin["rmdir"]>(({ path, directory, recursive }) => {
      const folder = `${String(directory)}/${path}`;
      if (!folderSet.has(folder)) return Promise.reject(notFound());
      if (inside(folder).length > 0 && recursive !== true)
        return Promise.reject(new Error("Folder is not empty"));
      for (const entry of inside(folder)) {
        fileSet.delete(entry);
        folderSet.delete(entry);
      }
      folderSet.delete(folder);
      return Promise.resolve();
    }),
    readdir: mock<FilesystemPlugin["readdir"]>(({ path, directory }) => {
      const folder = path ? `${String(directory)}/${path}` : String(directory);
      return Promise.resolve({
        files: inside(folder)
          .map((entry) => entry.slice(folder.length + 1))
          .filter((name) => !name.includes("/"))
          .map((name) => ({
            name,
            type: folderSet.has(`${folder}/${name}`)
              ? ("directory" as const)
              : ("file" as const),
            size: 1,
            mtime: 0,
            uri: `file:///${folder}/${name}`,
          })),
      });
    }),
  };
  return { fileSet, folderSet, filesystem };
};

// On Android and iOS a received attachment is handed to the operating system's
// opener. The MIME type comes from the sender's message type, so a peer picks
// which application receives the file: an APK goes to the package installer,
// HTML and SVG to a browser. Only the types the web build renders inline may
// leave the app.
describe("native attachment opening", () => {
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
      "audio/",
      "",
    ];
    for (const type of refused) {
      const device = fakeDevice();
      await expect(
        openFileNatively(new Blob(["x"], { type }), "file.bin", device),
      ).rejects.toThrow("This file type cannot be opened on this device.");
      expect(device.filesystem.writeFile).not.toHaveBeenCalled();
      expect(device.opener.openFile).not.toHaveBeenCalled();
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
      const device = fakeDevice();
      await openFileNatively(new Blob(["x"], { type }), "a.png", device, "t1");
      expect(device.filesystem.writeFile).toHaveBeenCalledTimes(1);
      // The type is passed explicitly, so Android does not fall back to
      // guessing it from a file name.
      expect(device.opener.openFile).toHaveBeenCalledTimes(1);
      expect(device.opener.openFile.mock.calls[0][0].mimeType).toBe(normalised);
    }
  });

  test("native attachment name ignores peer-supplied path components", () => {
    const cases: [string, string, string][] = [
      ["photo.png", "image/png", "t-photo.png"],
      [
        "../../Library/Preferences/evil.plist.png",
        "image/png",
        "t-evil_plist.png",
      ],
      ["..\\..\\Windows\\system32\\x.png", "image/png", "t-x.png"],
      ["/etc/passwd", "image/png", "t-passwd.png"],
      ["..", "image/png", "t-file.png"],
      ["", "application/pdf", "t-file.pdf"],
      // The extension is the allowlisted type's, never the sender's.
      ["invoice.html", "application/pdf", "t-invoice.pdf"],
      ["clip.apk", "video/mp4", "t-clip.mp4"],
      ["φωτογραφία 1.JPG", "image/jpeg", "t-1.jpg"],
      ["a\u0000b\nc.png", "image/png", "t-a_b_c.png"],
    ];
    for (const [filename, type, expected] of cases)
      expect(nativeAttachmentName(filename, type, "t")).toBe(expected);

    const long = nativeAttachmentName(
      `${"a".repeat(500)}.png`,
      "image/png",
      "t",
    );
    expect(long).toBe(`t-${"a".repeat(64)}.png`);

    for (const [filename, type] of cases) {
      const name = nativeAttachmentName(filename, type, "0123abcd");
      expect(name).toMatch(/^[A-Za-z0-9_-]{1,80}\.[a-z0-9]+$/);
      expect(name).not.toContain("..");
    }
    expect(() => nativeAttachmentName("x.html", "text/html", "t")).toThrow();
  });

  test("native attachments are written to the cache directory", async () => {
    const device = fakeDevice();
    const bytes = crypto.getRandomValues(new Uint8Array(100_003));
    const blob = new Blob([bytes], { type: "image/png" });

    await openFileNatively(blob, "../Documents/holiday.png", device, "t1");

    expect(device.filesystem.writeFile).toHaveBeenCalledTimes(1);
    const written = device.filesystem.writeFile.mock.calls[0][0];
    expect(written.directory).toBe(Directory.Cache);
    expect(written.path).toBe(`${NATIVE_ATTACHMENT_FOLDER}/t1-holiday.png`);
    expect(Buffer.from(String(written.data), "base64")).toEqual(
      Buffer.from(bytes),
    );
    expect(device.filesystem.getUri.mock.calls[0][0]).toEqual({
      path: `${NATIVE_ATTACHMENT_FOLDER}/t1-holiday.png`,
      directory: Directory.Cache,
    });
    expect(device.opener.openFile.mock.calls[0][0]).toEqual({
      path: `file:///CACHE/${NATIVE_ATTACHMENT_FOLDER}/t1-holiday.png`,
      mimeType: "image/png",
    });

    // Neither the attachment path nor the room QR writes anywhere else.
    for (const source of [
      read("../src/components/MessageItem/MessageDropdown.tsx"),
      read("../src/components/alerts/QRCodeAlert.tsx"),
    ]) {
      expect(source).toContain("openFileNatively(");
      expect(source).not.toMatch(/Directory\.(Documents|Data|External)/);
      expect(source).not.toMatch(/Filesystem\.(writeFile|appendFile)/);
    }
  });

  test("stale native attachments are removed at startup", async () => {
    const device = fakeDevice({
      [`CACHE/${NATIVE_ATTACHMENT_FOLDER}/a1-photo.png`]: "x",
      [`CACHE/${NATIVE_ATTACHMENT_FOLDER}/b2-room-invite.png`]: "y",
      "CACHE/WebView/Default/HTTP Cache/index": "kept",
    });

    await removeNativeFileCopies("android", device.filesystem);
    expect([...device.files.keys()]).toEqual([
      "CACHE/WebView/Default/HTTP Cache/index",
    ]);
    expect(device.filesystem.rmdir.mock.calls[0][0]).toEqual({
      path: NATIVE_ATTACHMENT_FOLDER,
      directory: Directory.Cache,
      recursive: true,
    });

    // A start with nothing left over is not an error.
    await removeNativeFileCopies("ios", device.filesystem);

    // The web never writes a copy, so it never touches the plugin.
    const web = fakeDevice();
    await removeNativeFileCopies("web", web.filesystem);
    expect(web.filesystem.rmdir).not.toHaveBeenCalled();

    // Any other failure is not swallowed.
    await expect(
      removeNativeFileCopies("ios", {
        rmdir: () =>
          Promise.reject(
            Object.assign(new Error("denied"), { code: "OS-PLUG-FILE-0007" }),
          ),
      }),
    ).rejects.toThrow("denied");

    // The entry point starts it on Android and iOS only, before rendering,
    // and loads the Filesystem plugin only there.
    const main = read("../src/main.tsx");
    const removal = main.indexOf(
      "removeNativeFilesAtStartup(Capacitor.getPlatform(), Filesystem)",
    );
    expect(removal).toBeGreaterThan(-1);
    expect(removal).toBeLessThan(main.indexOf("void boot()"));
    expect(main.indexOf("if (Capacitor.isNativePlatform())")).toBeLessThan(
      removal,
    );
    expect(main).not.toMatch(/^import .*@capacitor\/filesystem/m);
  });

  test("startup removes attachment copies written by earlier builds", async () => {
    const leftBehind = [
      // `${Date.now()}-${name}.${extension}` in Directory.Data.
      "DATA/1732612345678-holiday.png",
      "DATA/1732612345678-report.final.pdf",
      "DATA/1700000000000-voice message.webm",
      "DATA/1732612345678-unknown.",
      "DATA/1732612345678-.png",
      // The room QR code in Documents/p2party/.
      "DOCUMENTS/p2party/room-invite.png",
      // This build's cache copies.
      `CACHE/${NATIVE_ATTACHMENT_FOLDER}/0123abcd-photo.png`,
    ];
    const device = deviceWithFolders(leftBehind, [
      "DOCUMENTS/p2party",
      `CACHE/${NATIVE_ATTACHMENT_FOLDER}`,
    ]);
    const log = mock(() => {});

    await removeNativeFilesAtStartup("ios", device.filesystem, log);

    expect([...device.fileSet]).toEqual([]);
    expect([...device.folderSet]).toEqual([]);
    expect(log).not.toHaveBeenCalled();
    expect(device.filesystem.readdir.mock.calls[0][0]).toEqual({
      path: "",
      directory: Directory.Data,
    });

    // A failure never escapes startup, and the other copies still go.
    const stubborn = deviceWithFolders(
      [
        "DATA/1732612345678-a.png",
        "DATA/1732612345678-b.png",
        "DOCUMENTS/p2party/room-invite.png",
      ],
      ["DOCUMENTS/p2party"],
    );
    stubborn.filesystem.deleteFile.mockImplementationOnce(() =>
      Promise.reject(new Error("permission denied")),
    );
    await removeNativeFilesAtStartup("android", stubborn.filesystem, log);
    expect([...stubborn.fileSet]).toEqual([
      "DOCUMENTS/p2party/room-invite.png",
    ]);
    expect(log).toHaveBeenCalled();

    const unreadable = deviceWithFolders(
      ["DOCUMENTS/p2party/room-invite.png"],
      ["DOCUMENTS/p2party"],
    );
    unreadable.filesystem.readdir.mockImplementation(() =>
      Promise.reject(new Error("cannot list")),
    );
    unreadable.filesystem.rmdir.mockImplementation(() => {
      throw new Error("synchronous plugin failure");
    });
    await removeNativeFilesAtStartup("ios", unreadable.filesystem, log);
    expect([...unreadable.fileSet]).toEqual([]);

    const web = deviceWithFolders(["DATA/1732612345678-a.png"]);
    await removeNativeFilesAtStartup("web", web.filesystem, log);
    expect([...web.fileSet]).toEqual(["DATA/1732612345678-a.png"]);
    expect(web.filesystem.readdir).not.toHaveBeenCalled();
  });

  test("the legacy sweep leaves other files alone", async () => {
    const kept = [
      "DATA/notes.txt",
      "DATA/123-short.png",
      "DATA/173261234567-twelve-digits.png",
      "DATA/17326123456789-fourteen-digits.png",
      "DATA/x1732612345678-prefixed.png",
      "DATA/1732612345678_underscore.png",
      "DATA/1732612345678-no-extension",
      "DATA/1732612345678-unknown.exe2",
      "DATA/1732612345678-upper.PNG",
      "DATA/1732612345678-folder.png/inside.txt",
      "DATA/nested/1732612345678-deeper.png",
      "DOCUMENTS/p2party/notes.txt",
      "DOCUMENTS/room-invite.png",
      "DOCUMENTS/1732612345678-public.png",
      "CACHE/WebView/Default/HTTP Cache/index",
    ];
    const device = deviceWithFolders(
      [...kept, "DOCUMENTS/p2party/room-invite.png"],
      [
        "DATA/1732612345678-folder.png",
        "DATA/nested",
        "DOCUMENTS/p2party",
        "CACHE/WebView",
        "CACHE/WebView/Default",
        "CACHE/WebView/Default/HTTP Cache",
      ],
    );

    await removeNativeFilesAtStartup("android", device.filesystem, () => {});

    // Only the QR code went; its folder stays because it holds another file.
    expect([...device.fileSet].sort()).toEqual([...kept].sort());
    expect(device.folderSet.has("DOCUMENTS/p2party")).toBe(true);
    expect(device.folderSet.has("DATA/1732612345678-folder.png")).toBe(true);
    for (const call of device.filesystem.deleteFile.mock.calls)
      expect(["DOCUMENTS/p2party/room-invite.png"]).toContain(
        `${String(call[0].directory)}/${call[0].path}`,
      );

    expect(LEGACY_ATTACHMENT_NAME.test("1732612345678-a.docx")).toBe(true);
    expect(LEGACY_ATTACHMENT_NAME.test("1732612345678-a/b.png")).toBe(false);
    expect(LEGACY_ATTACHMENT_NAME.test("1732612345678-a.png\n")).toBe(false);
  });

  test("every purge removes native attachment copies", async () => {
    const steps = {
      purgeIdentity: () => Promise.resolve(),
      purge: () => Promise.resolve(),
      purgeRoom: () => Promise.resolve(),
    };
    const storage = emptyStorage;

    for (const target of ["identity", "room", "everything"] as const) {
      const device = fakeDevice({
        [`CACHE/${NATIVE_ATTACHMENT_FOLDER}/a1-photo.png`]: "x",
      });
      const outcome = await settlePurge(
        target,
        "https://example.com/r#room",
        steps,
        storage,
        () => removeNativeFileCopies("ios", device.filesystem),
      );
      expect(outcome.tone).toBe("good");
      expect(device.files.size).toBe(0);
    }

    const failed = await settlePurge(
      "everything",
      undefined,
      steps,
      storage,
      () => Promise.reject(new Error("cache folder is locked")),
    );
    expect(failed.tone).toBe("bad");
    expect(failed.causes).toEqual(["cache folder is locked"]);
  });

  test("the web inline check and the native check share one allowlist", () => {
    expect(openableMimeType("image/webp")).toBe("image/webp");
    expect(openableMimeType(" IMAGE/GIF ")).toBe("image/gif");
    expect(openableMimeType("image/svg+xml")).toBeUndefined();
    expect(openableMimeType("text/html")).toBeUndefined();
    expect(openableMimeType("constructor")).toBeUndefined();

    const dropdown = read("../src/components/MessageItem/MessageDropdown.tsx");
    expect(dropdown).toContain("openableMimeType(");
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

  // The preview an opened image or room QR code is shown in offers "Save
  // Image", and iOS terminates an app that writes to Photos without saying why.
  test("Info.plist explains saving an image to Photos", () => {
    const usage = read("../ios/App/App/Info.plist").match(
      /<key>NSPhotoLibraryAddUsageDescription<\/key>\s*<string>([^<]*)<\/string>/,
    );
    expect(usage?.[1].trim().length).toBeGreaterThan(0);
  });
});
