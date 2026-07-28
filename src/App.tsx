import { useEffect } from "react";
import { BrowserRouter } from "react-router";

import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
// import { ScreenOrientation } from "@capacitor/screen-orientation";
import { SafeArea, SystemBarsStyle } from "@capacitor-community/safe-area";

import { useDarkMode } from "usehooks-ts";
import { UniversalLinkProvider } from "./hooks/useUniversalLink";
import { AppRoutes } from "./routes";
import { lazyPages } from "./pages/registry";

import type { RoutePages } from "./pages/registry";

const App = ({ pages = lazyPages }: { pages?: RoutePages }) => {
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
        <AppRoutes pages={pages} />
      </UniversalLinkProvider>
    </BrowserRouter>
  );
};

export default App;
