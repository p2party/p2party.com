import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App";

const container = document.getElementById("root")!;

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

/**
 * Keep the prerendered page on screen until React has actually produced one.
 *
 * Every route ships as static HTML, and createRoot empties its container before
 * painting anything of its own. Measured on production: the landing page showed
 * 2,924 characters of correct content at 94ms, went blank at 103ms, and
 * repainted the identical 2,924 characters at 407ms. The blog was blank for
 * 364ms. Nothing moved -- cumulative layout shift was ~0 -- so it read purely
 * as a flash of the finished page, then nothing, then the finished page again.
 *
 * hydrateRoot is the usual answer and does not work here: the prerenderer is a
 * Playwright DOM snapshot (`page.content()`), not renderToString, so the markup
 * lacks the text-node separators hydration matches against. React rejects it
 * with error #418 and falls back to client rendering -- the same wipe, plus an
 * error in every visitor's console. Measured across all eleven content routes
 * before this was reverted.
 *
 * So the snapshot is moved aside instead of destroyed, and removed only once
 * React has real content to replace it with. It cannot be dropped on the first
 * commit either: every page is lazy behind a Suspense with no fallback, so the
 * first commit renders nothing at all and dropping it there would restore the
 * blank. The 200-character threshold is the one the prerenderer itself uses to
 * decide a route rendered.
 */
if (!container.hasChildNodes()) {
  createRoot(container).render(app);
} else {
  const holder = document.createElement("div");
  holder.setAttribute("data-prerendered", "");
  while (container.firstChild) holder.appendChild(container.firstChild);
  container.before(holder);

  // Exactly one copy is ever on screen. Without this the snapshot and React's
  // tree are both in flow while the page chunk loads, and the frame where
  // React commits paints the entire page twice, stacked -- measured at 365ms,
  // 5,850 characters against a settled 2,917, the document twice its height.
  container.style.display = "none";

  // Entry animations are for content arriving for the first time. This tree is
  // a second copy of markup the visitor is already reading, so it must appear
  // finished rather than fade in behind the copy it replaces. See index.css.
  container.setAttribute("data-adopted-prerender", "");

  createRoot(container).render(app);

  const startedAt = performance.now();
  const revealWhenReady = () => {
    // textContent, not innerText: innerText is defined in terms of layout, so
    // it returns "" for a display:none subtree and forces a reflow on every
    // frame it is asked. textContent reads the tree React has actually built.
    // Any content at all, not a character count. Every page is lazy behind a
    // fallback-less Suspense, so React's first commit renders literally
    // nothing and this stays false until the page chunk lands. A threshold
    // instead of a presence check is what stranded /blog/<unknown-slug> --
    // whose 404 view renders 194 characters -- under the stale snapshot for
    // the full deadline, with the live page mounted invisibly beneath it.
    const ready = (container.textContent ?? "").trim().length > 0;
    // The deadline matters: a route that legitimately renders less than the
    // threshold must not be left showing stale markup for ever.
    if (ready || performance.now() - startedAt > 4000) {
      container.style.display = "";
      holder.remove();
      return;
    }
    requestAnimationFrame(revealWhenReady);
  };
  requestAnimationFrame(revealWhenReady);
}
