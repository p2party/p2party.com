import { lazy, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Provider } from "react-redux";
import { Capacitor } from "@capacitor/core";
import { StatusBar } from "@capacitor/status-bar";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import p2party from "p2party";

const ChatLayout = lazy(() => import("./components/custom/ChatLayout"));

const HomePage = lazy(() => import("./pages/home"));
const RoomsPage = lazy(() => import("./pages/rooms"));
const ChatPage = lazy(() => import("./pages/chat"));
const TOSPage = lazy(() => import("./pages/tos"));
const PrivacyPage = lazy(() => import("./pages/privacy"));

const App = () => {
  useEffect(() => {
    const controller = new AbortController();

    const setMobileUI = async () => {
      if (Capacitor.getPlatform() !== "web") {
        // Display content under transparent status bar
        await StatusBar.setOverlaysWebView({ overlay: false });
        await ScreenOrientation.lock({ orientation: "portrait" });
      }
    };

    setMobileUI();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path='/privacy-policy' element={<PrivacyPage />} />
        <Route path='/terms-of-service' element={<TOSPage />} />

        <Route
          path='rooms'
          element={
            <Provider store={p2party.store}>
              <ChatLayout />
            </Provider>
          }
        >
          <Route index element={<RoomsPage />} />

          <Route path=':roomUrl' element={<ChatPage />} />
        </Route>

        <Route path='*' element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
