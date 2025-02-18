import { FC } from "react";
import { useParams } from "react-router";
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
  const { roomUrl } = useParams();
  const { peers, signalingServerConnectionState, connect, disconnectFromPeer } =
    useRoom();

  const handleDisconnectFromPeers = () => {
    const PEERS_LEN = peers.length;
    for (let i = 0; i < PEERS_LEN; i++) {
      disconnectFromPeer(peers[i].peerId);
    }
  };

  return (
    <Dropdown>
      <DropdownButton as={NavbarItem}>
        <UserGroupIcon />
      </DropdownButton>

      <DropdownMenu className='min-w-64' anchor='bottom start'>
        <DropdownHeader>
          <div className='pr-6'>
            <div className='text-xs text-zinc-500 dark:text-zinc-400'>
              Peers:
            </div>
            <div className='text-sm/7 font-semibold text-zinc-800 dark:text-white'>
              {peers.length + 1}
            </div>
          </div>
        </DropdownHeader>

        <DropdownDivider />

        {peers.length > 0 && (
          <>
            {signalingServerConnectionState.isConnected && (
              <DropdownItem onClick={() => connect(roomUrl ?? "")}>
                <SignalIcon />
                Connect with new peers
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
