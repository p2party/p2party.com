import { useEffect, useRef, FC, lazy } from "react";
import { Outlet } from "react-router-dom";
import { useLocalStorage } from "usehooks-ts";

import { SidebarLayout } from "../sidebar-layout";

import { useRoom } from "../../hooks/useRoom";
import { hasTransientRoomPin } from "../../protocol/roomAccess";

import type { PropsWithChildren } from "react";

// The chrome is not lazy: it renders on every room route, so splitting it only
// added a request, and a lazy component cannot be prerendered -- renderToString
// gives up on a suspending boundary and emits nothing, which is what left a
// room invite opening on an empty frame.
import NavBar from "../Nav";
import SideBar from "../Side";
const ConnectAlert = lazy(() => import("../alerts/ConnectAlert"));

const ChatLayout: FC<PropsWithChildren> = () => {
  const {
    signalingServerConnectionState,
    connect,
    disconnectFromSignalingServer,
    roomPolicy,
    roomUrl,
    roomInviteError,
  } = useRoom({ subscribeToMessages: false });
  const isConnected = signalingServerConnectionState.isConnected;
  const isEstablishingConnection =
    signalingServerConnectionState.isEstablishingConnection;
  const signalingServerHasUrl =
    signalingServerConnectionState.serverUrl.length > 0;
  const pinRequired = roomPolicy.authMode === "pin";
  const hasPin = roomUrl ? hasTransientRoomPin(roomUrl) : false;

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
    if (
      roomUrl &&
      roomInviteError.length === 0 &&
      pinRequired &&
      !hasPin &&
      !pressedCancelInConnect &&
      !alertIsOpen
    ) {
      setAlertIsOpen(true);
    }

    if (
      roomUrl &&
      roomInviteError.length === 0 &&
      (!pinRequired || hasPin) &&
      !pressedCancelInConnect &&
      !alertIsOpen &&
      !isConnected &&
      !isEstablishingConnection &&
      autoConnectAttemptedRoomRef.current !== roomUrl
    ) {
      autoConnectAttemptedRoomRef.current = roomUrl;
      void connect(roomUrl).catch(() => {
        autoConnectAttemptedRoomRef.current = null;
        setAlertIsOpen(true);
      });
    }

    if (pressedCancelInConnect || alertIsOpen) {
      autoConnectAttemptedRoomRef.current = null;
    }
  }, [
    alertIsOpen,
    pressedCancelInConnect,
    roomUrl,
    isConnected,
    isEstablishingConnection,
    connect,
    hasPin,
    pinRequired,
    roomInviteError,
    setAlertIsOpen,
  ]);

  useEffect(() => {
    const onFocus = () => {
      if (
        roomUrl &&
        roomInviteError.length === 0 &&
        !isConnected &&
        !isEstablishingConnection &&
        signalingServerHasUrl &&
        (!pinRequired || hasPin) &&
        !alertIsOpen &&
        !pressedCancelInConnect
      ) {
        void connect(roomUrl).catch(() => setAlertIsOpen(true));
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
    connect,
    disconnectFromSignalingServer,
    hasPin,
    pinRequired,
    roomInviteError,
    setAlertIsOpen,
  ]);

  return (
    <SidebarLayout
      navbar={<NavBar roomUrl={roomUrl ?? ""} />}
      sidebar={<SideBar />}
    >
      {roomInviteError.length > 0 ? (
        <main className='flex min-h-0 flex-1 items-center justify-center p-6'>
          <div
            role='alert'
            className='shadow-brutal max-w-xl border-2 border-red-700 bg-red-50 p-5 font-mono text-sm text-red-900 dark:bg-red-950/40 dark:text-red-100'
          >
            <p className='font-black uppercase'>Invalid room invitation</p>
            <p className='mt-2'>{roomInviteError}</p>
            <p className='mt-3 text-xs opacity-80'>
              Nothing was connected and no replacement room was generated.
            </p>
          </div>
        </main>
      ) : (
        <Outlet />
      )}

      {roomUrl && roomInviteError.length === 0 && (
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
