import { lazy, Suspense, useState, useEffect } from "react";

import { SidebarItem, SidebarBody, SidebarSpacer } from "../sidebar";
import Spinner from "../custom/spinner";

import {
  HomeIcon,
  UserIcon,
  TrashIcon,
  SignalSlashIcon,
} from "@heroicons/react/16/solid";

import { useRoom } from "../../hooks/useRoom";

const SignalingDropdownSidebar = lazy(
  () => import("../dropdowns/signalingDropdownSidebar"),
);
const PeerDropdownSidebar = lazy(
  () => import("../dropdowns/peerDropdownSidebar"),
);
const ChannelDropdownSidebar = lazy(
  () => import("../dropdowns/channelDropdownSidebar"),
);

export interface ConnectButtonSidebarParams {
  roomUrl: string;
}

const ConnectButtonSidebar = ({ roomUrl }: ConnectButtonSidebarParams) => {
  const {
    roomId,
    peerId,
    signalingServerConnectionState,
    connect,
    peers,
    channels,
    purge,
  } = useRoom();

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
    <SidebarBody>
      {(signalingServerConnectionState.isEstablishingConnection ||
        isConnecting) &&
        peers.length === 0 &&
        channels.length === 0 && (
          <SidebarItem>
            <span className='flex min-w-0 items-center gap-3'>
              <SignalSlashIcon className='size-7' />
            </span>
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                Connecting
              </span>
              <span className='block truncate text-xs/7 font-normal text-zinc-500 dark:text-zinc-400'>
                <Spinner />
              </span>
            </span>
          </SidebarItem>
        )}

      {(signalingServerConnectionState.isConnected ||
        peers.length > 0 ||
        channels.length > 0) && (
        <>
          <Suspense>
            <SignalingDropdownSidebar />

            <PeerDropdownSidebar />

            <ChannelDropdownSidebar />
          </Suspense>

          <SidebarItem>
            <span className='flex min-w-0 items-center gap-3'>
              <HomeIcon className='size-10' />
              <span className='min-w-0'>
                <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                  Room ID:
                </span>
                <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                  {roomId.length > 0 ? roomId : '""'}
                </span>
              </span>
            </span>
          </SidebarItem>

          <SidebarItem>
            <span className='flex min-w-0 items-center gap-3'>
              <UserIcon className='size-10' />
              <span className='min-w-0'>
                <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                  My Peer ID:
                </span>
                <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                  {peerId.length > 0 ? peerId : '""'}
                </span>
              </span>
            </span>
          </SidebarItem>

          <SidebarSpacer />

          <SidebarItem onClick={purge}>
            <span className='flex min-w-0 items-center gap-3'>
              <TrashIcon className='size-7' />
              <span className='min-w-0 text-sm/5 font-medium text-zinc-950 dark:text-white'>
                Delete
              </span>
            </span>
          </SidebarItem>
        </>
      )}

      {!signalingServerConnectionState.isConnected &&
        !isConnecting &&
        peers.length === 0 &&
        channels.length === 0 && (
          <SidebarItem onClick={handleConnectClick}>
            <span className='flex min-w-0 items-center gap-3'>
              <SignalSlashIcon className='size-7' />
            </span>
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                Connect
              </span>
              <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                Disconnected
              </span>
            </span>
          </SidebarItem>
        )}
    </SidebarBody>
  );
};

export default ConnectButtonSidebar;
