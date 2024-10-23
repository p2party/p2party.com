import { lazy, Suspense, useState } from "react";
import { useParams } from "react-router-dom";
// import { useLocalStorage } from "usehooks-ts";

import { SidebarLayout } from "../sidebar-layout";
import ConnectAlert from "../alerts/ConnectAlert";
import Spinner from "./spinner";

const NavBar = lazy(() => import("../navigation/navbar"));
const SideBar = lazy(() => import("../navigation/sidebar"));

import type { PropsWithChildren } from "react";
import Footer from "./footer";

const Layout = ({ children }: PropsWithChildren) => {
  const { roomUrl } = useParams();
  let [alertIsOpen, setAlertIsOpen] = useState(true); // useLocalStorage(
  //   "show-privacy-alert",
  //   true,
  // );

  return (
    <SidebarLayout
      navbar={
        <Suspense fallback={<Spinner />}>
          <NavBar roomUrl={roomUrl ?? ""} />
        </Suspense>
      }
      sidebar={
        <Suspense fallback={<Spinner />}>
          <SideBar roomUrl={roomUrl ?? ""} />
        </Suspense>
      }
    >
      {children}

      <ConnectAlert
        roomUrl={roomUrl ?? ""}
        isOpen={alertIsOpen}
        setIsOpen={setAlertIsOpen}
      />

      <Footer />
    </SidebarLayout>
  );
};

export default Layout;
