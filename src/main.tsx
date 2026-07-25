import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import p2party from "p2party";

import "./index.css";
import App from "./App";
import { SELF_HOSTED_WASM_PATH } from "./protocol/wasm";

p2party.setWasmSourceUrl(new URL(SELF_HOSTED_WASM_PATH, window.location.href));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
