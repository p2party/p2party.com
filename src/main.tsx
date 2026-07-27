import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import "./index.css";
import App from "./App";
import { pagesForPath, resolvePages } from "./pages/registry";

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
