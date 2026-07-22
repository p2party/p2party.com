import { useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { useLocalStorage } from "usehooks-ts";

import p2party from "p2party";

import type { Message } from "p2party";

export interface MessageWithData extends Message {
  data: string | File;
}

export const DEFAULT_SIGNALING_URL = "wss://signaling.p2party.com/ws";
export const DEFAULT_STUN_URLS = ["stun:stun.p2party.com:3478"];

export const useRoom = () => {
  const { roomUrl } = useParams();
  const navigate = useNavigate();
  const [percentageFilledChunk] = useLocalStorage("percentageFilledChunk", 90);
  const [chunks] = useLocalStorage("chunksToSplitMessage", 1);

  const [signalingServerUrl, setSignalingServerUrl] = useLocalStorage(
    "signalingServerUrl",
    DEFAULT_SIGNALING_URL,
  );
  const [stunServerUrls, setStunServerUrls] = useLocalStorage<string[]>(
    "stunServerUrls",
    DEFAULT_STUN_URLS,
  );

  const keyPair = useSelector(p2party.keyPairSelector);
  const rooms = useSelector(p2party.roomSelector);
  // const commonState = useSelector(p2party.commonStateSelector)
  const signalingServerConnection = useSelector(
    p2party.signalingServerSelector,
  );

  const roomIndex = useMemo(() => {
    const i = rooms.findIndex((r) => r.url === roomUrl);
    return i > -1 && rooms[i].id.length > 0 ? i : -1;
  }, [roomUrl, rooms]);
  const [selectedChannel, setSelectedChannel] = useState("main");

  const goToRandomRoom = useCallback(
    async (replace = false) => {
      const random = await p2party.generateRandomRoomUrl();
      navigate("/rooms/" + random, { replace });
    },
    [navigate],
  );

  const connectToRoom = useCallback(
    async (roomUrl: string) => {
      const rtcConfig: RTCConfiguration = {
        iceServers: stunServerUrls.length > 0 ? [{ urls: stunServerUrls }] : [],
        iceTransportPolicy: "all" as RTCIceTransportPolicy,
      };
      await p2party.connect(roomUrl, signalingServerUrl, rtcConfig);
    },
    [signalingServerUrl, stunServerUrls],
  );

  const connectToSignaling = useCallback(
    async (roomUrl: string) => {
      await p2party.connectToSignalingServer(roomUrl, signalingServerUrl);
    },
    [signalingServerUrl],
  );

  const sendMessage = async (message: string | File, channel: string) => {
    if (roomIndex === -1) throw new Error("No room was selected");

    await p2party.sendMessage(
      message,
      channel,
      rooms[roomIndex].id,
      percentageFilledChunk / 100,
      chunks,
    );
  };

  return {
    keyPair,
    peerId: keyPair.peerId,
    roomId: roomIndex > -1 ? rooms[roomIndex].id : "",
    onlyConnectWithKnownPeers:
      roomIndex > -1 ? rooms[roomIndex].onlyConnectWithKnownAddresses : false,
    signalingServerUrl,
    setSignalingServerUrl,
    stunServerUrls,
    setStunServerUrls,
    signalingServerConnectionState: signalingServerConnection,
    peers: roomIndex > -1 ? rooms[roomIndex].peers : [],
    channels: roomIndex > -1 ? rooms[roomIndex].channels : [],
    messages: roomIndex > -1 ? rooms[roomIndex].messages : [],
    selectedChannel,
    goToRandomRoom,
    connect: connectToRoom,
    connectToSignalingServer: connectToSignaling,
    disconnect: p2party.disconnectFromRoom,
    disconnectFromSignalingServer: p2party.disconnectFromSignalingServer,
    disconnectFromRoom: p2party.disconnectFromRoom,
    disconnectFromAllRooms: p2party.disconnectFromAllRooms,
    disconnectFromPeer: p2party.disconnectFromPeer,
    setOnlyConnectToKnownPeers: p2party.onlyAllowConnectionsFromAddressBook,
    addPeerToAddressBook: p2party.addPeerToAddressBook,
    getPeerFromAddressBook: p2party.getPeerAddressBookEntry,
    removePeerFromAddressBook: p2party.deletePeerFromAddressBook,
    blacklistPeer: p2party.blacklistPeer,
    peerIsBlacklisted: p2party.getPeerIsBlacklisted,
    getAllPastRooms: p2party.getAllExistingRooms,
    // openChannel,
    selectChannel: setSelectedChannel,
    sendMessage,
    readMessage: p2party.readMessage,
    cancelMessage: p2party.cancelMessage,
    deleteMessage: p2party.deleteMessage,
    purge: p2party.purge,
    purgeRoom: p2party.purgeRoom,
    purgeIdentity: p2party.purgeIdentity,
  };
};
