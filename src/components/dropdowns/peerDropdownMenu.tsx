import { useParams } from "react-router-dom";
import { SignalIcon, SignalSlashIcon } from "@heroicons/react/20/solid";

import { useRoom } from "../../hooks/useRoom";
import { DropdownMenu, DropdownItem } from "../dropdown";

const PeerDropdownMenu = () => {
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
  );
};

export default PeerDropdownMenu;
