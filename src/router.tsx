import p2party from "p2party";
import { lazy, Suspense } from "react";
import { Provider } from "react-redux";
import {
  Route,
  createBrowserRouter,
  createRoutesFromElements,
} from "react-router-dom";

const ChatLayout = lazy(() => import("./components/custom/ChatLayout"));

const HomePage = lazy(() => import("./pages/home"));
const RoomsPage = lazy(() => import("./pages/rooms"));
const ChatPage = lazy(() => import("./pages/chat"));
const TOSPage = lazy(() => import("./pages/tos"));
const PrivacyPage = lazy(() => import("./pages/privacy"));

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route
        index
        element={
          <Suspense>
            <HomePage />
          </Suspense>
        }
      />
      <Route
        path='/privacy-policy'
        element={
          <Suspense>
            <PrivacyPage />
          </Suspense>
        }
      />
      <Route
        path='/terms-of-service'
        element={
          <Suspense>
            <TOSPage />
          </Suspense>
        }
      />

      <Route
        path='rooms'
        element={
          <Provider store={p2party.store}>
            <Suspense>
              <ChatLayout />
            </Suspense>
          </Provider>
        }
      >
        <Route
          index
          element={
            <Suspense>
              <RoomsPage />
            </Suspense>
          }
        />

        <Route
          path=':roomUrl'
          element={
            <Suspense>
              <ChatPage />
            </Suspense>
          }
        />
      </Route>

      <Route
        path='*'
        element={
          <Suspense>
            <HomePage />
          </Suspense>
        }
      />
    </Route>,
  ),
);
