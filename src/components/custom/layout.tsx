import { useState, useEffect, FC } from "react";
import { useParams, useNavigate } from "react-router-dom";
import p2party from "p2party";
// import { useLocalStorage } from "usehooks-ts";

import { SidebarLayout } from "../sidebar-layout";
// import { StackedLayout } from "../stacked-layout";
import ConnectAlert from "../alerts/ConnectAlert";

import NavBar from "../Nav";
import SideBar from "../Side";

import type { PropsWithChildren } from "react";
// import Footer from "./footer";

const Layout: FC<PropsWithChildren> = ({ children }) => {
  const { roomUrl } = useParams();
  const navigate = useNavigate();

  let [alertIsOpen, setAlertIsOpen] = useState(true); // useLocalStorage(
  //   "show-privacy-alert",
  //   true,
  // );

  useEffect(() => {
    const controller = new AbortController();

    const getRandomRoomId = async () => {
      const random = await p2party.generateRandomRoomUrl();
      navigate("/" + random, { replace: true });
    };

    if (roomUrl?.length !== 64) {
      getRandomRoomId();
    }

    return () => {
      controller.abort();
    };
  }, [roomUrl]);

  return (
    <SidebarLayout
      // <StackedLayout
      navbar={<NavBar roomUrl={roomUrl ?? ""} />}
      sidebar={<SideBar />}
    >
      {children}

      <ConnectAlert
        roomUrl={roomUrl ?? ""}
        isOpen={alertIsOpen}
        setIsOpen={setAlertIsOpen}
      />

      {/* <Footer /> */}
    </SidebarLayout>
    // </StackedLayout>
  );
};

export default Layout;
