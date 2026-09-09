import { prerenderToNodeStream } from "react-dom/static";
import { StaticRouter } from "react-router";

import { AppRoutes } from "./routes";
import { pagesForPath, resolvePages } from "./pages/registry";

/**
 * Render one route to complete, hydratable HTML.
 *
 * The static API waits for lazy components and Suspense before emitting HTML.
 * The streaming API produced inline boundary-repair scripts on the room pages,
 * even when piping from onAllReady. The site's CSP blocks those scripts, leaving
 * hydration to fail and recover by rendering again in the browser. Complete
 * static output hydrates without allowing inline JavaScript or a fixed nonce.
 *
 * The tree deliberately omits what App wraps around the routes: BrowserRouter
 * (replaced here), UniversalLinkProvider and useDarkMode. None of them render
 * DOM -- the provider returns its children, and the hook only acts in effects,
 * which never run during server rendering -- so the markup matches the client's
 * first render while nothing in it requires a browser.
 */
export const render = async (url: string): Promise<string> => {
  const pages = await resolvePages(pagesForPath(url));
  const errors: unknown[] = [];
  const { prelude, postponed } = await prerenderToNodeStream(
    <StaticRouter location={url}>
      <AppRoutes pages={pages} />
    </StaticRouter>,
    {
      // Large completed boundaries otherwise become hidden fragments followed
      // by inline reveal scripts. This build already buffers the whole page;
      // keep its completed boundaries in place instead of streaming fragments.
      progressiveChunkSize: Number.MAX_SAFE_INTEGER,
      onError: (error) => {
        errors.push(error);
      },
    },
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude)
    chunks.push(Buffer.from(chunk as Uint8Array));
  if (errors.length > 0) {
    const error = errors[0];
    throw error instanceof Error ? error : new Error(String(error));
  }
  if (postponed !== null)
    throw new Error(`Incomplete static render for ${url}`);
  const html = Buffer.concat(chunks).toString("utf8");
  // Route markup has no executable scripts; Vite supplies the external entry
  // in the document shell. Fail the build if React needs script-assisted repair.
  if (/<script\b/iu.test(html))
    throw new Error(`Static render requires a script for ${url}`);
  return html;
};
