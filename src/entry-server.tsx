import { Writable } from "node:stream";

import { renderToPipeableStream } from "react-dom/server";
import { StaticRouter } from "react-router";

import { AppRoutes } from "./routes";
import { lazyPages } from "./pages/registry";

/**
 * Render one route to complete, hydratable HTML.
 *
 * renderToString was the obvious choice and is the wrong one: it does not
 * support Suspense, and every page here is lazy behind a boundary, so it gave
 * up on the first one and emitted "Switched to client rendering because the
 * server rendering aborted" in place of a page. renderToPipeableStream's
 * onAllReady waits for every boundary to resolve and then hands over the whole
 * document at once -- exactly the semantics a build step wants, and it lets the
 * pages stay lazy here as well as on the client instead of needing a second,
 * eagerly-imported copy of the route table.
 *
 * The tree deliberately omits what App wraps around the routes: BrowserRouter
 * (replaced here), UniversalLinkProvider and useDarkMode. None of them render
 * DOM -- the provider returns its children, and the hook only acts in effects,
 * which never run during server rendering -- so the markup matches the client's
 * first render while nothing in it requires a browser.
 */
export const render = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    let html = "";
    // The room routes mount the SDK's store, whose module-level singleton keeps
    // dispatching after the tree is complete. That drove React to call
    // onAllReady a second time, and the second pipe threw "React currently only
    // supports piping to one writable stream" -- which then failed every
    // subsequent room render in the same process, so /rooms passed and /r did
    // not purely by being second. Everything here is once-only for that reason.
    let piped = false;
    let settled = false;

    const sink = new Writable({
      write(chunk, _encoding, callback) {
        html += String(chunk);
        callback();
      },
    });
    sink.on("finish", () => {
      if (settled) return;
      settled = true;
      resolve(html);
    });

    const stream = renderToPipeableStream(
      <StaticRouter location={url}>
        <AppRoutes pages={lazyPages} />
      </StaticRouter>,
      {
        onAllReady() {
          if (piped) return;
          piped = true;
          stream.pipe(sink);
        },
        // A page that cannot render is a build failure, not something to paper
        // over by writing a half-rendered file. Errors arriving after the tree
        // is already written are the store still talking to itself, and must
        // not turn a finished page into a rejection.
        onError(error) {
          if (settled) return;
          settled = true;
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      },
    );
  });
