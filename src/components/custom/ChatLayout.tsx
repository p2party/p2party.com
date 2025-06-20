import { useEffect, FC, lazy } from "react";
import { useParams, Outlet } from "react-router-dom";
import { useLocalStorage } from "usehooks-ts";

import { SidebarLayout } from "../sidebar-layout";

import { useRoom } from "../../hooks/useRoom";

import type { PropsWithChildren } from "react";

const NavBar = lazy(() => import("../Nav"));
const SideBar = lazy(() => import("../Side"));
const ConnectAlert = lazy(() => import("../alerts/ConnectAlert"));

const ChatLayout: FC<PropsWithChildren> = () => {
  const {
    signalingServerConnectionState,
    goToRandomRoom,
    connectToSignalingServer,
    disconnectFromSignalingServer,
  } = useRoom();
  const { roomUrl } = useParams();

  // let [alertIsOpen, setAlertIsOpen] = useState(false);
  const [alertIsOpen, setAlertIsOpen] = useLocalStorage(
    "alertIsOpenInRoom" + roomUrl,
    true,
  );
  // let [pressedCancelInConnect, setPressedCancelInConnect] = useState(false);
  const [pressedCancelInConnect, setPressedCancelInConnect] = useLocalStorage(
    "pressedCancelButtonInRoom" + roomUrl,
    true,
  );

  useEffect(() => {
    const controller = new AbortController();

    if (
      roomUrl &&
      roomUrl.length === 64 &&
      !pressedCancelInConnect &&
      !alertIsOpen
    ) {
      connectToSignalingServer(roomUrl);
    }

    if (roomUrl && roomUrl.length !== 64) {
      goToRandomRoom(true);
    }

    return () => {
      controller.abort();
    };
  }, [alertIsOpen, pressedCancelInConnect, roomUrl]);

  useEffect(() => {
    const onFocus = () => {
      if (
        roomUrl &&
        roomUrl.length === 64 &&
        !signalingServerConnectionState.isConnected &&
        !signalingServerConnectionState.isEstablishingConnection &&
        signalingServerConnectionState.serverUrl.length > 0 &&
        !alertIsOpen &&
        !pressedCancelInConnect
      ) {
        connectToSignalingServer(roomUrl);
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeunload", disconnectFromSignalingServer);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeunload", disconnectFromSignalingServer);
    };
  }, [
    roomUrl,
    signalingServerConnectionState,
    pressedCancelInConnect,
    alertIsOpen,
    connectToSignalingServer,
    disconnectFromSignalingServer,
  ]);

  return (
    <SidebarLayout
      navbar={<NavBar roomUrl={roomUrl ?? ""} />}
      sidebar={<SideBar />}
    >
      <Outlet />

      {roomUrl && roomUrl.length === 64 && (
        <ConnectAlert
          roomUrl={roomUrl}
          isOpen={alertIsOpen}
          setIsOpen={setAlertIsOpen}
          setPressedCancel={setPressedCancelInConnect}
        />
      )}
    </SidebarLayout>
  );
};

export default ChatLayout;
