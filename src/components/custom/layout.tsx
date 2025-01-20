import { useState } from "react";
import { useParams } from "react-router-dom";
// import { useLocalStorage } from "usehooks-ts";

import { SidebarLayout } from "../sidebar-layout";
// import { StackedLayout } from "../stacked-layout";
import ConnectAlert from "../alerts/ConnectAlert";

import NavBar from "../Nav";
import SideBar from "../Side";

import type { PropsWithChildren } from "react";
// import Footer from "./footer";

const Layout = ({ children }: PropsWithChildren) => {
  const { roomUrl } = useParams();

  let [alertIsOpen, setAlertIsOpen] = useState(true); // useLocalStorage(
  //   "show-privacy-alert",
  //   true,
  // );

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
