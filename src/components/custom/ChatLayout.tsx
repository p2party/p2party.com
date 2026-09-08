import { useEffect, useRef, FC, lazy } from "react";
import { Outlet } from "react-router";

import { SidebarLayout } from "../sidebar-layout";

import { useConnectDialog } from "../../hooks/useConnectDialog";
import { useRoom } from "../../hooks/useRoom";
import { hasTransientRoomPin } from "../../protocol/roomAccess";
import { advanceAutoConnectAttempt } from "../../lib/autoConnectGate";

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
  const pinRequired = roomPolicy.authMode === "pin";
  const hasPin = roomUrl ? hasTransientRoomPin(roomUrl) : false;

  // Shared with the room view, which raises this dialog again after a PIN
  // failure; both flags outlive a reload so an answered question is not
  // re-asked.
  const {
    isOpen: alertIsOpen,
    setIsOpen: setAlertIsOpen,
    wasDismissed: pressedCancelInConnect,
    setWasDismissed: setPressedCancelInConnect,
  } = useConnectDialog(roomUrl);
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

    const admission = advanceAutoConnectAttempt({
      roomUrl,
      roomInviteErrorLength: roomInviteError.length,
      pinRequired,
      hasPin,
      pressedCancelInConnect,
      alertIsOpen,
      isConnected,
      isEstablishingConnection,
      attemptedRoomUrl: autoConnectAttemptedRoomRef.current,
    });
    autoConnectAttemptedRoomRef.current = admission.attemptedRoomUrl;
    if (roomUrl && admission.shouldConnect) {
      void connect(roomUrl).catch(() => {
        autoConnectAttemptedRoomRef.current = null;
        setAlertIsOpen(true);
      });
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
    // The SDK's heartbeat and reconnect controller own focus, visibility,
    // pageshow and online recovery, including terminal refusal and backoff.
    // A second UI wake handler would bypass those decisions with connect().
    window.addEventListener("beforeunload", disconnectFromSignalingServer);
    return () => {
      window.removeEventListener("beforeunload", disconnectFromSignalingServer);
    };
  }, [disconnectFromSignalingServer]);

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
