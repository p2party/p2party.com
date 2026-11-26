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
 * the file name. Neither platform's opener reports when the viewer is done
 * with the file (the iOS preview resolves when it is shown, the Android
 * intent when it is started), so copies are removed at the next start and by
 * every purge rather than after use.
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
    if ((error as { code?: unknown } | null)?.code === FILE_NOT_FOUND) return;
    throw error;
  }
};
