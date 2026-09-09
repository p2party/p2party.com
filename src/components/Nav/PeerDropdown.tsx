import { FC } from "react";
import {
  BookOpenIcon,
  SignalIcon,
  SignalSlashIcon,
  UserGroupIcon,
  ArchiveBoxXMarkIcon,
} from "@heroicons/react/20/solid";

import { useRoom } from "../../hooks/useRoom";

import {
  Dropdown,
  DropdownHeader,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownMenu,
} from "../dropdown";
import { NavbarItem } from "../navbar";

import type { Dispatch, SetStateAction } from "react";

export interface PeerDropdownProps {
  setAddressBookIsOpen: Dispatch<SetStateAction<boolean>>;
  setBlacklistIsOpen: Dispatch<SetStateAction<boolean>>;
}

const PeerDropdown: FC<PeerDropdownProps> = ({
  setAddressBookIsOpen,
  setBlacklistIsOpen,
}) => {
  const {
    roomUrl,
    peers,
    reachablePeers,
    signalingServerConnectionState,
    connect,
    disconnectFromPeer,
  } = useRoom({ subscribeToMessages: false });

  const handleDisconnectFromPeers = () => {
    const PEERS_LEN = peers.length;
    for (let i = 0; i < PEERS_LEN; i++) {
      disconnectFromPeer(peers[i].peerId);
    }
  };

  return (
    <Dropdown>
      <DropdownButton
        as={NavbarItem}
        aria-label='Peers and contacts'
        title='Peers and contacts'
      >
        <UserGroupIcon className='size-6 text-zinc-500 dark:text-zinc-400' />
        {peers.length > 0 && (
          <span className='bg-darkOrange absolute -top-1 -right-1 flex min-w-[1.25rem] items-center justify-center rounded-full text-xs text-white'>
            {reachablePeers.length + 1 > 99 ? "99+" : reachablePeers.length + 1}
          </span>
        )}
      </DropdownButton>

      <DropdownMenu className='min-w-64' anchor='bottom start'>
        <DropdownHeader>
          <div className='pr-6'>
            <div className='text-xs text-zinc-500 dark:text-zinc-400'>
              Connected peers:
            </div>
            <div className='text-sm/7 font-semibold text-zinc-800 dark:text-white'>
              {reachablePeers.length + 1}
            </div>
          </div>
        </DropdownHeader>

        <DropdownDivider />

        {peers.length > 0 && (
          <>
            {signalingServerConnectionState.isConnected && (
              <DropdownItem onClick={() => connect(roomUrl ?? "")}>
                <SignalIcon />
                Discover new peers
              </DropdownItem>
            )}

            <DropdownItem onClick={handleDisconnectFromPeers}>
              <SignalSlashIcon />
              Disconnect from peers
            </DropdownItem>

            <DropdownDivider />
          </>
        )}

        {peers.length === 0 && signalingServerConnectionState.isConnected && (
          <>
            <DropdownItem onClick={() => connect(roomUrl ?? "")}>
              <SignalIcon />
              Connect to peers
            </DropdownItem>

            <DropdownDivider />
          </>
        )}

        <DropdownItem onClick={() => setAddressBookIsOpen(true)}>
          <BookOpenIcon />
          Show address book
        </DropdownItem>

        <DropdownItem onClick={() => setBlacklistIsOpen(true)}>
          <ArchiveBoxXMarkIcon />
          Show blacklist
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};

export default PeerDropdown;
