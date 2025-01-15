// import { useParams } from "react-router-dom";

import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "../dropdown";
import { SidebarItem } from "../sidebar";

import {
  SignalIcon,
  XMarkIcon,
  // NoSymbolIcon,
  EllipsisHorizontalIcon,
  SignalSlashIcon,
  CheckIcon,
} from "@heroicons/react/20/solid";

import { useRoom } from "../../hooks/useRoom";

const SignalingDropdownSidebar = () => {
  // const { roomUrl } = useParams();
  const {
    signalingServerConnectionState,
    connectToSignalingServer,
    disconnectFromSignalingServer,
  } = useRoom();

  return (
    <Dropdown>
      <DropdownButton as={SidebarItem}>
        {signalingServerConnectionState.isConnected && (
          <span className='flex min-w-0 items-center gap-3'>
            <SignalIcon className='size-9' />
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                Discoverable
              </span>
              <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                Connected to signaling server
              </span>
            </span>
          </span>
        )}

        {signalingServerConnectionState.isEstablishingConnection && (
          <span className='flex min-w-0 items-center gap-3'>
            <div className='relative size-7'>
              {/* First icon (background) */}
              <SignalIcon className='absolute inset-0 size-7' />

              {/* Second icon (foreground) */}
              <EllipsisHorizontalIcon className='absolute inset-0 size-7' />
            </div>
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                Signaling server
              </span>
              <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                {signalingServerConnectionState.isConnected
                  ? "Disconnecting"
                  : "Connecting"}
              </span>
            </span>
          </span>
        )}

        {!signalingServerConnectionState.isEstablishingConnection &&
          !signalingServerConnectionState.isConnected && (
            <span className='flex min-w-0 items-center gap-3'>
              <SignalSlashIcon className='size-7' />
              <span className='min-w-0'>
                <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                  Non-discoverable
                </span>
                <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                  Disconnected from signaling server
                </span>
              </span>
            </span>
          )}
      </DropdownButton>
      <DropdownMenu className='min-w-64' anchor='bottom start'>
        {signalingServerConnectionState.isConnected && (
          <>
            <DropdownItem onClick={disconnectFromSignalingServer}>
              <XMarkIcon />
              Disconnect from signaling server
            </DropdownItem>

            {/*
              <DropdownItem>
                <NoSymbolIcon />
                Disconnect and stop receiving signaling info
              </DropdownItem>
            */}
          </>
        )}

        {!signalingServerConnectionState.isConnected && (
          <DropdownItem onClick={() => connectToSignalingServer()}>
            <CheckIcon />
            Connect to signaling server
          </DropdownItem>
        )}
      </DropdownMenu>
    </Dropdown>
  );
};

export default SignalingDropdownSidebar;
