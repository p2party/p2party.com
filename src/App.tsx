import { useEffect } from "react";
import { BrowserRouter } from "react-router";

import { Capacitor, SystemBars } from "@capacitor/core";
import { StatusBar } from "@capacitor/status-bar";
// import { ScreenOrientation } from "@capacitor/screen-orientation";

import { useDarkMode } from "usehooks-ts";
import { UniversalLinkProvider } from "./hooks/useUniversalLink";
import { AppRoutes } from "./routes";
import { lazyPages } from "./pages/registry";
import { useVisualViewport } from "./hooks/useVisualViewport";
import { applySystemBarTheme } from "./protocol/systemBars";

import type { RoutePages } from "./pages/registry";

const App = ({ pages = lazyPages }: { pages?: RoutePages }) => {
  const { isDarkMode } = useDarkMode();
  useVisualViewport();

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

  // The theme follows the system appearance (prefers-color-scheme), so this
  // runs at start-up and again whenever the appearance changes while the app
  // is open.
  useEffect(() => {
    applySystemBarTheme(Capacitor.getPlatform(), isDarkMode, {
      systemBars: SystemBars,
      statusBar: StatusBar,
    }).catch((error: unknown) => {
      console.error("Could not style the status bar", error);
    });
  }, [isDarkMode]);

  return (
    <BrowserRouter>
      <UniversalLinkProvider>
        <AppRoutes pages={pages} />
      </UniversalLinkProvider>
    </BrowserRouter>
  );
};

export default App;
