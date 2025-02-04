import { StrictMode, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Provider } from "react-redux";
import p2party from "p2party";

import "./index.css";

const Layout = lazy(() => import("./components/custom/layout"));
const HomePage = lazy(() => import("./pages/home"));
const ChatPage = lazy(() => import("./pages/chat"));
const TOSPage = lazy(() => import("./pages/tos"));
const PrivacyPage = lazy(() => import("./pages/privacy"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path='/privacy-policy' element={<PrivacyPage />} />
        <Route path='/terms-of-service' element={<TOSPage />} />
        <Route
          path='/:roomUrl'
          element={
            <Provider store={p2party.store}>
              <Layout>
                <ChatPage />
              </Layout>
            </Provider>
          }
        />
        <Route path='/' element={<HomePage />} />
        <Route
          path='*'
          element={
            <Provider store={p2party.store}>
              <Layout>
                <ChatPage />
              </Layout>
            </Provider>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
