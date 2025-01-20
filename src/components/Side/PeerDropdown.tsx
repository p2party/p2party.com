import { useParams } from "react-router-dom";
import { SignalIcon, SignalSlashIcon } from "@heroicons/react/20/solid";

import { useRoom } from "../../hooks/useRoom";

import { UserGroupIcon } from "@heroicons/react/20/solid";

import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from "../dropdown";
import { SidebarItem } from "../sidebar";

const PeerDropdown = () => {
  const { roomUrl } = useParams();
  const { peers, signalingServerConnectionState, connect, disconnectFromPeer } =
    useRoom();

  const handleDisconnectFromPeers = () => {
    const PEERS_LEN = peers.length;
    for (let i = 0; i < PEERS_LEN; i++) {
      console.log("DISCONNECT FROM PEER ID " + peers[i].peerId);
      disconnectFromPeer(peers[i].peerId);
    }
  };

  return (
    <Dropdown>
      <DropdownButton as={SidebarItem}>
        <span className='flex min-w-0 items-center gap-3'>
          <UserGroupIcon className='size-8 lg:size-7' />
          <span className='min-w-0'>
            <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
              Peers in room
            </span>
            <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
              {peers.length + 1}
            </span>
          </span>
        </span>
      </DropdownButton>

      <DropdownMenu className='min-w-64' anchor='bottom start'>
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
          </>
        )}

        {peers.length === 0 && signalingServerConnectionState.isConnected && (
          <DropdownItem onClick={() => connect(roomUrl ?? "")}>
            <SignalIcon />
            Connect to peers
          </DropdownItem>
        )}
      </DropdownMenu>
    </Dropdown>
  );
};

export default PeerDropdown;
