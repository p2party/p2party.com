import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import p2party from "p2party";

import "./index.css";
import App from "./App";

p2party.setWasmSourceUrl(
  new URL("/vendor/p2party-0.13.0/libcrypto.wasm", window.location.href),
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
