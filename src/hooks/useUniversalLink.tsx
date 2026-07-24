import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { App, URLOpenListenerEvent } from "@capacitor/app";

export const UniversalLinkProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const navigate = useNavigate();
  const launchUrlHandledRef = useRef(false);

  useEffect(() => {
    const handleUrlOpen = (e: URLOpenListenerEvent) => {
      const slug = e.url.split("p2party.com").pop();
      if (slug && !launchUrlHandledRef.current) {
        launchUrlHandledRef.current = true;
        navigate(slug, { replace: true });
      }
    };

    const listener = App.addListener("appUrlOpen", handleUrlOpen);

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [navigate]);

  return children;
};
