import { useEffect, useRef, FC, lazy } from "react";
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
  const isConnected = signalingServerConnectionState.isConnected;
  const isEstablishingConnection =
    signalingServerConnectionState.isEstablishingConnection;
  const signalingServerHasUrl =
    signalingServerConnectionState.serverUrl.length > 0;
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
  const autoConnectAttemptedRoomRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    if (
      roomUrl &&
      roomUrl.length === 64 &&
      !pressedCancelInConnect &&
      !alertIsOpen &&
      !isConnected &&
      !isEstablishingConnection &&
      autoConnectAttemptedRoomRef.current !== roomUrl
    ) {
      autoConnectAttemptedRoomRef.current = roomUrl;
      connectToSignalingServer(roomUrl);
    }

    if (roomUrl && roomUrl.length !== 64) {
      autoConnectAttemptedRoomRef.current = null;
      goToRandomRoom(true);
    }

    if (pressedCancelInConnect || alertIsOpen) {
      autoConnectAttemptedRoomRef.current = null;
    }

    return () => {
      controller.abort();
    };
  }, [
    alertIsOpen,
    pressedCancelInConnect,
    roomUrl,
    isConnected,
    isEstablishingConnection,
    connectToSignalingServer,
    goToRandomRoom,
  ]);

  useEffect(() => {
    const onFocus = () => {
      if (
        roomUrl &&
        roomUrl.length === 64 &&
        !isConnected &&
        !isEstablishingConnection &&
        signalingServerHasUrl &&
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
    isConnected,
    isEstablishingConnection,
    signalingServerHasUrl,
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
