import { useState, useEffect, createContext } from "react";
import { useNavigate } from "react-router";
import { App, URLOpenListenerEvent } from "@capacitor/app";

const UniversalLinkContext = createContext<void>(undefined);

export const UniversalLinkProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const navigate = useNavigate();
  const [launchUrlHandled, setLaunchUrlHandled] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    const handleUrlOpen = (e: URLOpenListenerEvent) => {
      console.log("appUrlOpen", launchUrlHandled);
      const slug = e.url.split("p2party.com").pop();
      if (slug && !launchUrlHandled) {
        setLaunchUrlHandled(true);
        navigate(slug, { replace: true });
      }
    };

    App.addListener("appUrlOpen", handleUrlOpen);

    return () => {
      abortController.abort();
      App.removeAllListeners();
    };
  }, [navigate]);

  return (
    <UniversalLinkContext.Provider value={undefined}>
      {children}
    </UniversalLinkContext.Provider>
  );
};
