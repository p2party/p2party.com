import { useEffect } from "react";
import { useNavigate } from "react-router";
import { App } from "@capacitor/app";

import { resolveUniversalLinkTarget } from "../protocol/universalLink";

import type { URLOpenListenerEvent } from "@capacitor/app";

export const UniversalLinkProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    let receivedWarmLink = false;

    const navigateToInvite = (value: string) => {
      const target = resolveUniversalLinkTarget(value);
      if (active && target) navigate(target, { replace: true });
    };
    const handleUrlOpen = ({ url }: URLOpenListenerEvent) => {
      receivedWarmLink = true;
      navigateToInvite(url);
    };

    const listener = App.addListener("appUrlOpen", handleUrlOpen);
    void App.getLaunchUrl()
      .then((launch) => {
        if (!receivedWarmLink && launch?.url) navigateToInvite(launch.url);
      })
      .catch(() => {
        // A browser build can lack a native launch URL. Do not log invitation
        // material while treating that expected state as "no launch link".
      });

    return () => {
      active = false;
      void listener.then((handle) => handle.remove());
    };
  }, [navigate]);

  return children;
};
