import type { Message, Room } from "p2party";

export function isLocalMessage(message: Message, localPublicKey: string) {
  return message.fromPeerPublicKey
    ? message.fromPeerPublicKey === localPublicKey
    : !!message.transferId;
}

/** The routing ID is a safety-number input. Resolve it from a session
 * authenticated to this message's sender, including after a server rekey. */
export function authenticatedSenderRoute(rooms: Room[], publicKey: string) {
  for (const room of rooms) {
    const peer = room.peers.find((peer) => {
      const handshake = room.handshakeStatusByPeer?.[peer.peerId];
      return (
        peer.peerPublicKey === publicKey &&
        handshake?.status === "authenticated" &&
        handshake.peerPublicKey === publicKey
      );
    });
    if (peer) return peer.peerId;
  }
  return undefined;
}
