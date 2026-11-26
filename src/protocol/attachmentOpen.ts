import { Directory } from "@capacitor/filesystem";

import type { FilesystemPlugin } from "@capacitor/filesystem";
import type { FileOpenerPlugin } from "@capawesome-team/capacitor-file-opener";

/**
 * The file types this app hands to a viewer, each with the extension a native
 * copy is saved under: a browser tab on the web, the operating system's opener
 * on Android and iOS.
 *
 * A received file's MIME type follows the message type its sender chose, and
 * MessageType includes ImageSVG, CodeHTML and ExecutableAPK. On the web a
 * blob: URL inherits this page's origin, so a peer's .html or .svg opened in a
 * tab would run script against our localStorage and IndexedDB, which hold
 * identity and ratchet state. On Android and iOS the type picks the receiving
 * application: an APK goes to the package installer, HTML and SVG to a
 * browser. Only types that cannot carry script are listed. The audio and video
 * entries are the SDK's own (KnownMimeType), which is every type a read-back
 * file can carry.
 */
export const OPENABLE_TYPES: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "video/x-matroska": "mkv",
  "video/x-ms-wmv": "wmv",
  "video/x-flv": "flv",
};

/** The type without parameters, lower-cased, when it is allowlisted. */
export const openableMimeType = (type: string): string | undefined => {
  const mime = type.split(";", 1)[0].trim().toLowerCase();
  // image/svg+xml must never match: SVG is a script-bearing document.
  return Object.prototype.hasOwnProperty.call(OPENABLE_TYPES, mime)
    ? mime
    : undefined;
};

export const UNOPENABLE_FILE_MESSAGE =
  "This file type cannot be opened on this device.";

/**
 * Native copies live in their own folder inside Capacitor's cache directory,
 * which the platforms leave out of backups and may clear under storage
 * pressure. Its own folder, because Android keeps the WebView's HTTP cache in
 * the same directory and removing that is not ours to do.
 */
export const NATIVE_ATTACHMENT_FOLDER = "p2party-attachments";

const NAME_STEM_MAX = 64;

/**
 * The name a native copy is written under, built by this app.
 *
 * The sender's file name contributes only its last path component, stripped
 * of its extension and reduced to letters, digits, "_" and "-", at most 64 of
 * them. The extension comes from the allowlisted type, never from the sender.
 * `unique` keeps two copies of one file apart.
 */
export const nativeAttachmentName = (
  filename: string,
  mimeType: string,
  unique: string,
): string => {
  const extension = OPENABLE_TYPES[openableMimeType(mimeType) ?? ""];
  if (extension === undefined) throw new Error(UNOPENABLE_FILE_MESSAGE);
  const base = filename.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, NAME_STEM_MAX);
  return `${unique.replace(/[^A-Za-z0-9]/g, "")}-${stem || "file"}.${extension}`;
};

const randomToken = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

/** Base64 in pieces of a multiple of three bytes, so they concatenate. */
const toBase64 = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const piece = 3 * 0x1000;
  let encoded = "";
  for (let offset = 0; offset < bytes.length; offset += piece)
    encoded += btoa(
      String.fromCharCode(...bytes.subarray(offset, offset + piece)),
    );
  return encoded;
};

export interface NativeFilePlugins {
  filesystem: Pick<FilesystemPlugin, "writeFile" | "getUri">;
  opener: Pick<FileOpenerPlugin, "openFile">;
}

/**
 * Opens a file with the operating system's opener on Android and iOS: a
 * received attachment, or an image this app made.
 *
 * A type outside the allowlist is refused before anything is written. The
 * copy goes to the cache folder under a name this app builds, and the type is
 * passed to the opener explicitly; without it Android guesses the type from
 * the file name. The installed opener does not tell the app when the viewer
 * is done with the file: iOS reports the preview closing to the plugin, which
 * does not forward it, and the Android intent is started without asking for a
 * result. So copies are removed at the next start and by every purge rather
 * than after use.
 */
export const openFileNatively = async (
  blob: Blob,
  filename: string,
  plugins: NativeFilePlugins,
  unique: string = randomToken(),
): Promise<void> => {
  const mimeType = openableMimeType(blob.type);
  if (mimeType === undefined) throw new Error(UNOPENABLE_FILE_MESSAGE);
  const path = `${NATIVE_ATTACHMENT_FOLDER}/${nativeAttachmentName(filename, mimeType, unique)}`;
  await plugins.filesystem.writeFile({
    path,
    data: await toBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  });
  const { uri } = await plugins.filesystem.getUri({
    path,
    directory: Directory.Cache,
  });
  await plugins.opener.openFile({ path: uri, mimeType });
};

/** The Filesystem plugin's code for a path that does not exist (both platforms). */
const FILE_NOT_FOUND = "OS-PLUG-FILE-0008";

/**
 * Removes every native copy: at startup, for what a previous run left behind,
 * and by every purge. Nothing to do on the web, which never writes one, nor
 * when the folder does not exist; any other failure is thrown.
 */
export const removeNativeFileCopies = async (
  platform: string,
  filesystem: Pick<FilesystemPlugin, "rmdir">,
): Promise<void> => {
  if (platform === "web") return;
  try {
    await filesystem.rmdir({
      path: NATIVE_ATTACHMENT_FOLDER,
      directory: Directory.Cache,
      recursive: true,
    });
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
};

const isNotFound = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === FILE_NOT_FOUND;

/**
 * The extensions earlier builds could write: p2party 0.14.10's
 * KnownFileExtension, or none for a type it did not know.
 */
// prettier-ignore
const LEGACY_EXTENSIONS = [
  "png", "jpeg", "jpg", "gif", "bmp", "tiff", "svg", "webp", "heic", "ico",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "odt",
  "mp3", "wav", "aac", "flac", "ogg", "m4a", "mp4", "avi", "mkv", "mov",
  "wmv", "flv", "webm", "zip", "rar", "7z", "tar", "gz", "html", "css", "js",
  "ts", "jsx", "tsx", "json", "xml", "py", "java", "c", "cpp", "cs", "rb",
  "php", "sql", "epub", "mobi", "azw", "ttf", "otf", "exe", "dmg", "apk",
];

/**
 * The name earlier builds gave a decrypted attachment in Directory.Data:
 * `${Date.now()}-${name without its extension}.${extension}`. Thirteen digits
 * cover every millisecond timestamp from 2001 to 2286.
 */
export const LEGACY_ATTACHMENT_NAME = new RegExp(
  `^\\d{13}-[^/\\\\]*\\.(?:${LEGACY_EXTENSIONS.join("|")})?$`,
);

/** Where earlier builds saved the room QR code, in Directory.Documents. */
const LEGACY_QR_FOLDER = "p2party";
const LEGACY_QR_FILE = `${LEGACY_QR_FOLDER}/room-invite.png`;

/**
 * Removes the copies earlier builds wrote outside the cache folder: decrypted
 * attachments at the top of Directory.Data (iOS Documents, Android files/)
 * named as LEGACY_ATTACHMENT_NAME describes, and the room QR code in
 * Documents/p2party/ together with that folder if nothing else is in it.
 * Deletes nothing else. Never throws: a failed step is logged and the next
 * one runs.
 */
export const removeLegacyNativeFileCopies = async (
  platform: string,
  filesystem: Pick<FilesystemPlugin, "deleteFile" | "readdir" | "rmdir">,
  log: (message: string, error: unknown) => void = console.error,
): Promise<void> => {
  if (platform === "web") return;
  const attempt = async (step: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      if (!isNotFound(error)) log(`Could not ${step}`, error);
    }
  };

  await attempt("remove the room QR code an earlier build saved", () =>
    filesystem.deleteFile({
      path: LEGACY_QR_FILE,
      directory: Directory.Documents,
    }),
  );
  // Not recursive: a folder that still holds anything else is left alone.
  await attempt("remove the folder an earlier build saved the QR code in", () =>
    filesystem.rmdir({
      path: LEGACY_QR_FOLDER,
      directory: Directory.Documents,
      recursive: false,
    }),
  );

  let entries: { name: string; type: string }[] = [];
  await attempt("list the files an earlier build may have left", async () => {
    entries = (
      await filesystem.readdir({ path: "", directory: Directory.Data })
    ).files;
  });
  for (const entry of entries)
    if (entry.type === "file" && LEGACY_ATTACHMENT_NAME.test(entry.name))
      await attempt("remove an attachment copy an earlier build left", () =>
        filesystem.deleteFile({ path: entry.name, directory: Directory.Data }),
      );
};

/**
 * Everything that runs at an Android or iOS start: this build's cache copies
 * and the copies earlier builds left elsewhere. Never throws.
 */
export const removeNativeFilesAtStartup = async (
  platform: string,
  filesystem: Pick<FilesystemPlugin, "deleteFile" | "readdir" | "rmdir">,
  log: (message: string, error: unknown) => void = console.error,
): Promise<void> => {
  try {
    await removeNativeFileCopies(platform, filesystem);
  } catch (error) {
    log("Could not remove earlier attachment copies", error);
  }
  await removeLegacyNativeFileCopies(platform, filesystem, log);
};
