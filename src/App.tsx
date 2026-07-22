import { lazy, useEffect, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Provider } from "react-redux";

import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
// import { ScreenOrientation } from "@capacitor/screen-orientation";
import { SafeArea, SystemBarsStyle } from "@capacitor-community/safe-area";

import p2party from "p2party";

import { useDarkMode } from "usehooks-ts";
import { UniversalLinkProvider } from "./hooks/useUniversalLink";

const ChatLayout = lazy(() => import("./components/custom/ChatLayout"));

const HomePage = lazy(() => import("./pages/home"));
const RoomsPage = lazy(() => import("./pages/rooms"));
const ChatPage = lazy(() => import("./pages/chat"));
const TOSPage = lazy(() => import("./pages/tos"));
const PrivacyPage = lazy(() => import("./pages/privacy"));

const App = () => {
  const { isDarkMode } = useDarkMode();

  // useEffect(() => {
  //   const controller = new AbortController();

  //   const setMobileUI = async () => {
  //     if (Capacitor.getPlatform() !== "web") {
  //       await ScreenOrientation.lock({ orientation: "portrait" });
  //     }
  //   };

  //   setMobileUI();

  //   return () => {
  //     controller.abort();
  //   };
  // }, []);

  useEffect(() => {
    const controller = new AbortController();

    const changeSafeArea = async () => {
      if (Capacitor.getPlatform() !== "web") {
        if (isDarkMode) {
          // await StatusBar.setBackgroundColor({ color: "#000" });
          await StatusBar.setStyle({ style: Style.Dark });
          await SafeArea.setSystemBarsStyle({
            style: SystemBarsStyle.Dark,
          });
        } else {
          // await StatusBar.setBackgroundColor({ color: "#fff" });
          await StatusBar.setStyle({ style: Style.Dark });
          await SafeArea.setSystemBarsStyle({
            style: SystemBarsStyle.Light,
          });
        }
      }
    };

    changeSafeArea();

    return () => {
      controller.abort();
    };
  }, [isDarkMode]);

  return (
    <BrowserRouter>
      <UniversalLinkProvider>
        <Routes>
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
        </Routes>
      </UniversalLinkProvider>
    </BrowserRouter>
  );
};

export default App;
