import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";

import "./index.css";
import App from "./App";
import { pagesForPath, resolvePages } from "./pages/registry";
import { scrubLegacyRoomUiKeysAtStartup } from "./protocol/roomUiStorage";

// Earlier builds named per-room UI flags in localStorage by the room
// capability. Move them to the room's tag now, on every route and before
// anything renders, so a visit that never opens a room still removes them.
// The scrub module does not import the SDK, which stays on the room routes.
scrubLegacyRoomUiKeysAtStartup(() => window.localStorage);

// On Android and iOS, opened attachments and saved room QR codes are copies in
// the cache folder, and earlier builds left copies in the app's documents.
// Nothing tells the app when a viewer is done with one, so the copies earlier
// runs left behind are removed at each start. This runs in the background and
// is not awaited: a file opened within the first moments of a start could be
// removed along with them. Imported only here, so the web's entry chunk does
// not load the Filesystem plugin.
if (Capacitor.isNativePlatform())
  void Promise.all([
    import("@capacitor/filesystem"),
    import("./protocol/attachmentOpen"),
  ])
    .then(([{ Filesystem }, { removeNativeFilesAtStartup }]) =>
      removeNativeFilesAtStartup(Capacitor.getPlatform(), Filesystem),
    )
    .catch((error: unknown) => {
      console.error("Could not remove earlier attachment copies", error);
    });

const container = document.getElementById("root")!;

/**
 * Adopt the prerendered page rather than replacing it.
 *
 * Every route is rendered to static HTML at build time by entry-server, so the
 * markup in the container is React's own output and can be hydrated. That was
 * not true before: the prerenderer used to snapshot a live DOM with Playwright,
 * which produces markup hydration cannot match (no text-node separators), so
 * the only options were to throw the page away -- 300ms of blank on the landing
 * page, 364ms on the blog -- or to hide the wipe behind a second copy.
 *
 * The route's own modules are resolved BEFORE hydrating. Hydrating a Suspense
 * boundary whose content is not ready makes React discard the server markup and
 * render the fallback, which for a boundary with no fallback is the blank page
 * this whole exercise is about. Every other route stays lazy, so this costs one
 * chunk, the one being looked at.
 */
const boot = async () => {
  const prerendered = container.hasChildNodes();
  const pages = prerendered
    ? await resolvePages(pagesForPath(window.location.pathname))
    : undefined;

  const app = (
    <StrictMode>
      <App pages={pages} />
    </StrictMode>
  );

  if (prerendered) hydrateRoot(container, app);
  else createRoot(container).render(app);
};

void boot();
