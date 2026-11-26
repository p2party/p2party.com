/**
 * The attachment types this app hands to a viewer: a browser tab on the web,
 * the operating system's opener on Android and iOS.
 *
 * A received file's MIME type follows the message type its sender chose, and
 * MessageType includes ImageSVG, CodeHTML and ExecutableAPK. On the web a
 * blob: URL inherits this page's origin, so a peer's .html or .svg opened in a
 * tab would run script against our localStorage and IndexedDB, which hold
 * identity and ratchet state. On Android and iOS the type picks the receiving
 * application: an APK goes to the package installer, HTML and SVG to a
 * browser. Only types that cannot carry script are listed. An entry ending in
 * "/" admits every subtype.
 */
export const OPENABLE_MIME_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "audio/",
  "video/",
  "application/pdf",
];

/** The type without parameters, lower-cased, when it is allowlisted. */
export const openableMimeType = (type: string): string | undefined => {
  const mime = type.split(";", 1)[0].trim().toLowerCase();
  // image/svg+xml must never match: SVG is a script-bearing document.
  const allowed = OPENABLE_MIME_TYPES.some((safe) =>
    safe.endsWith("/") ? mime.startsWith(safe) : mime === safe,
  );
  return allowed ? mime : undefined;
};

export interface NativeFileShell {
  /** Writes the file into the app's storage and returns its native URI. */
  save: (path: string, blob: Blob) => Promise<string>;
  /** Hands the file to the operating system's opener. */
  open: (uri: string, mimeType: string) => Promise<void>;
}

/**
 * Opens an attachment with the operating system's opener on Android and iOS.
 * A type outside the allowlist is refused before anything is written.
 */
export const openAttachmentNatively = async (
  blob: Blob,
  path: string,
  shell: NativeFileShell,
): Promise<void> => {
  const mimeType = openableMimeType(blob.type);
  if (mimeType === undefined)
    throw new Error("This file type cannot be opened on this device.");
  const uri = await shell.save(path, blob);
  // Passed explicitly: without it Android guesses the type from the file
  // name, which the sender also chose.
  await shell.open(uri, mimeType);
};
