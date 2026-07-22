import p2party from "p2party";
import { createElement, lazy, Suspense } from "react";
import { Provider } from "react-redux";
import {
  Route,
  createBrowserRouter,
  createRoutesFromElements,
} from "react-router-dom";

const chatLayoutComponent = lazy(
  () => import("./components/custom/ChatLayout"),
);

const homePageComponent = lazy(() => import("./pages/home"));
const roomsPageComponent = lazy(() => import("./pages/rooms"));
const chatPageComponent = lazy(() => import("./pages/chat"));
const tosPageComponent = lazy(() => import("./pages/tos"));
const privacyPageComponent = lazy(() => import("./pages/privacy"));

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route
        index
        element={<Suspense>{createElement(homePageComponent)}</Suspense>}
      />
      <Route
        path='/privacy-policy'
        element={<Suspense>{createElement(privacyPageComponent)}</Suspense>}
      />
      <Route
        path='/terms-of-service'
        element={<Suspense>{createElement(tosPageComponent)}</Suspense>}
      />

      <Route
        path='rooms'
        element={
          <Provider store={p2party.store}>
            <Suspense>{createElement(chatLayoutComponent)}</Suspense>
          </Provider>
        }
      >
        <Route
          index
          element={<Suspense>{createElement(roomsPageComponent)}</Suspense>}
        />

        <Route
          path=':roomUrl'
          element={<Suspense>{createElement(chatPageComponent)}</Suspense>}
        />
      </Route>

      <Route
        path='*'
        element={<Suspense>{createElement(homePageComponent)}</Suspense>}
      />
    </Route>,
  ),
);
