import { StrictMode, lazy } from "react";
import { createRoot } from "react-dom/client";
import { SafeArea } from "@capacitor-community/safe-area";

SafeArea.enable({
  config: {},
});

import "./index.css";

const App = lazy(() => import("./App"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
