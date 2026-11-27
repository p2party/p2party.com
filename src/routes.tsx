import { Suspense } from "react";
import { Route, Routes } from "react-router";

import { SiteFrame } from "./components/SiteFrame";
import type { RoutePages } from "./pages/registry";

/**
 * The route table, independent of which router encloses it and of how its
 * pages were loaded. The server renders it under a StaticRouter with eager
 * components; the client renders it under a BrowserRouter with lazy ones.
 * Keeping one copy is what stops the prerendered markup and the hydrated tree
 * from drifting apart -- a difference here is a hydration mismatch, which is
 * paid for by throwing the prerendered page away.
 */
export const AppRoutes = ({ pages }: { pages: RoutePages }) => {
  const {
    Home,
    Rooms,
    Chat,
    TOS,
    Privacy,
    SessionLab,
    Guide,
    Explorer,
    Blog,
    BlogPost,
    ChatLayout,
    RoomProviders,
  } = pages;

  return (
    <Routes>
      <Route element={<SiteFrame />}>
        <Route
          index
          element={
            <Suspense>
              <Home />
            </Suspense>
          }
        />
        <Route
          path='/privacy-policy'
          element={
            <Suspense>
              <Privacy />
            </Suspense>
          }
        />
        <Route
          path='/terms-of-service'
          element={
            <Suspense>
              <TOS />
            </Suspense>
          }
        />
        <Route
          path='/session-lab'
          element={
            <Suspense>
              <SessionLab />
            </Suspense>
          }
        />
        {(["protocol", "roadmap", "whitepaper", "wallet"] as const).map(
          (page) => (
            <Route
              key={page}
              path={`/${page}`}
              element={
                <Suspense>
                  <Guide page={page} />
                </Suspense>
              }
            />
          ),
        )}
        {(["overview", "testnet", "mainnet"] as const).map((page) => (
          <Route
            key={page}
            path={page === "overview" ? "/explorer" : `/explorer/${page}`}
            element={
              <Suspense>
                <Explorer page={page} />
              </Suspense>
            }
          />
        ))}
        <Route
          path='/blog'
          element={
            <Suspense>
              <Blog />
            </Suspense>
          }
        />
        <Route
          path='/blog/:slug'
          element={
            <Suspense>
              <BlogPost />
            </Suspense>
          }
        />

        <Route
          path='*'
          element={
            <Suspense>
              <Home />
            </Suspense>
          }
        />
      </Route>
      <Route
        path='rooms'
        element={
          <Suspense>
            <RoomProviders>
              <ChatLayout />
            </RoomProviders>
          </Suspense>
        }
      >
        <Route
          index
          element={
            <Suspense>
              <Rooms />
            </Suspense>
          }
        />
      </Route>

      <Route
        path='r'
        element={
          <Suspense>
            <RoomProviders>
              <ChatLayout />
            </RoomProviders>
          </Suspense>
        }
      >
        <Route
          index
          element={
            <Suspense>
              <Chat />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
};
