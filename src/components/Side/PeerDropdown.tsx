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
            <span className='block truncate text-sm/5 font-medium text-zinc-100'>
              Connected peers
            </span>
            <span className='block truncate font-mono text-xs/5 font-normal text-zinc-400'>
              {reachablePeers.length + 1}
              {/* A peer in the roster whose handshake has not finished cannot
                  receive anything yet. Saying so is better than a number that
                  quietly disagrees with what a send will do. */}
              {peers.length > reachablePeers.length &&
                ` · ${String(peers.length - reachablePeers.length)} connecting`}
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
