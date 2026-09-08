import { useEffect, useRef, FC, lazy } from "react";
import { Outlet } from "react-router";

import { SidebarLayout } from "../sidebar-layout";

import { useConnectDialog } from "../../hooks/useConnectDialog";
import { useRoom } from "../../hooks/useRoom";
import { hasTransientRoomPin } from "../../protocol/roomAccess";
import {
  shouldAutoConnect,
  shouldReleaseAutoConnectAttempt,
} from "../../lib/autoConnectGate";

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
    // C4: a socket that dropped after a successful auto-connect must let the
    // room try again. This has to run FIRST, in the same pass that reads the
    // ref below -- a ref mutation schedules no render, so a separate effect
    // that clears it afterward is one commit too late: on a bare drop with no
    // other dependency change, the auto-connect check below would already
    // have read the stale ref by the time that effect ran. The SDK's own
    // bounded backoff is the primary repair; this stops the layout's one-shot
    // ref from permanently disarming the UI path.
    if (
      shouldReleaseAutoConnectAttempt({
        isConnected,
        isEstablishingConnection,
        attemptedRoomUrl: autoConnectAttemptedRoomRef.current,
      })
    ) {
      autoConnectAttemptedRoomRef.current = null;
    }

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
      shouldAutoConnect({
        roomUrl,
        roomInviteErrorLength: roomInviteError.length,
        pinRequired,
        hasPin,
        pressedCancelInConnect,
        alertIsOpen,
        isConnected,
        isEstablishingConnection,
        attemptedRoomUrl: autoConnectAttemptedRoomRef.current,
      })
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

  // The deferred wake handler is read through a ref: the macrotask is scheduled
  // by a listener from an older render, and by the time it fires the SDK's
  // liveness check may have marked the socket disconnected and re-rendered.
  const reconnectOnResumeRef = useRef<() => void>(() => {});

  useEffect(() => {
    reconnectOnResumeRef.current = () => {
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

    // Every wake path -- window focus, the tab becoming visible, a bfcache
    // restore (pageshow) and the network returning (online) -- reaches the
    // SDK's liveness check on the same event, which synchronously marks a
    // half-open socket disconnected. Defer one macrotask so that Redux update,
    // and the re-render it causes, land before the guard above is read.
    const onResume = () => {
      setTimeout(() => reconnectOnResumeRef.current(), 0);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onResume();
    };

    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);
    window.addEventListener("online", onResume);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", disconnectFromSignalingServer);

    return () => {
      // A wake macrotask still pending after unmount must not reconnect a room
      // the user just left; on a dependency change the next run re-arms it.
      reconnectOnResumeRef.current = () => {};
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
      window.removeEventListener("online", onResume);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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
