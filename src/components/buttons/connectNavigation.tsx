import * as Headless from "@headlessui/react";
import { lazy, useState, useEffect, Suspense } from "react";

import { useRoom } from "../../hooks/useRoom";

import { TrashIcon, SignalSlashIcon } from "@heroicons/react/20/solid";

import { NavbarSection, NavbarItem } from "../navbar";
import Spinner from "../custom/spinner";

const SignalingDropdownNavigation = lazy(
  () => import("../dropdowns/signalingDropdownNavigation"),
);
const PeerDropdownNavigation = lazy(
  () => import("../dropdowns/peerDropdownNavigation"),
);
const ChannelDropdownNavigation = lazy(
  () => import("../dropdowns/channelDropdownNavigation"),
);
const ChannelListbox = lazy(() => import("../dropdowns/channelListbox"));

export interface ConnectButtonNavigationProps {
  roomUrl: string;
}

const ConnectButtonNavigation = ({ roomUrl }: ConnectButtonNavigationProps) => {
  const { signalingServerConnectionState, connect, peers, channels, messages } =
    useRoom();

  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (signalingServerConnectionState.isConnected && isConnecting) {
      setIsConnecting(false);
    }
  }, [signalingServerConnectionState]);

  const handleConnectClick = () => {
    setIsConnecting(true);
    connect(roomUrl);
  };

  return (
    <NavbarSection>
      {(signalingServerConnectionState.isEstablishingConnection ||
        isConnecting) &&
        peers.length === 0 &&
        channels.length === 0 && (
          <NavbarItem>
            Connecting
            <Spinner />
          </NavbarItem>
        )}

      {(signalingServerConnectionState.isConnected ||
        peers.length > 0 ||
        channels.length > 0) && (
        <>
          <Suspense fallback={<Spinner />}>
            {messages.length > 0 && (
              <Headless.Field className='hidden items-baseline justify-between gap-6 sm:flex lg:hidden'>
                <Suspense fallback={<Spinner />}>
                  <ChannelListbox />
                </Suspense>
              </Headless.Field>
            )}
            <Suspense fallback={<Spinner />}>
              <SignalingDropdownNavigation />
            </Suspense>

            <Suspense fallback={<Spinner />}>
              <PeerDropdownNavigation />
            </Suspense>

            <Suspense fallback={<Spinner />}>
              <ChannelDropdownNavigation />
            </Suspense>
          </Suspense>

          <NavbarItem aria-label='delete'>
            <TrashIcon />
          </NavbarItem>
        </>
      )}

      {!signalingServerConnectionState.isConnected &&
        !isConnecting &&
        peers.length === 0 &&
        channels.length === 0 && (
          <NavbarItem onClick={handleConnectClick}>
            Connect
            <SignalSlashIcon />
          </NavbarItem>
        )}
    </NavbarSection>
  );
};

export default ConnectButtonNavigation;
