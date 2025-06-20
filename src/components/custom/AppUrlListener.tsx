import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { App, URLOpenListenerEvent } from "@capacitor/app";

import type { FC } from "react";

const AppUrlListener: FC = () => {
  const navigate = useNavigate();

  const [openedUrl, setOpenedUrl] = useState(false);

  useEffect(() => {
    App.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
      const slug = event.url.split("p2party.com").pop();
      console.log(slug);
      if (slug) {
        navigate(slug, { replace: true });
      }
      // If no match, do nothing - let regular routing
      // logic take over
    });

    const abortController = new AbortController();

    const checkOpen = async () => {
      const launchUrl = await App.getLaunchUrl();
      const slug = launchUrl?.url.split("p2party.com").pop() ?? "";
      if (slug.length > 0 && !openedUrl) {
        setOpenedUrl(true);
        navigate(slug, { replace: true });
      }
    };

    checkOpen();

    return () => {
      App.removeAllListeners();
      abortController.abort();
    };
  }, []);

  return null;
};

export default AppUrlListener;
