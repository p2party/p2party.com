import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { useSelector } from "react-redux";
import { useLocalStorage } from "usehooks-ts";

import p2party from "p2party";

import type { Message } from "p2party";

export interface MessageWithData extends Message {
  data: string | File;
}

export const useRoom = () =>
  // signalingServerUrl = "ws://localhost:3001/ws",
  // rtcConfig: RTCConfiguration = {
  //   iceServers: [
  //     {
  //       urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
  //     },
  //   ],
  // },
  {
    const { roomUrl } = useParams();
    const [chunks] = useLocalStorage("chunksToSplitMessage", 3);

    const keyPair = useSelector(p2party.keyPairSelector);
    const rooms = useSelector(p2party.roomSelector);
    // const commonState = useSelector(p2party.commonStateSelector)
    const signalingServerConnection = useSelector(
      p2party.signalingServerSelector,
    );

    const [roomIndex, setRoomIndex] = useState(-1);
    const [selectedChannel, setSelectedChannel] = useState("main");
    const [iceServers, setIceServers] = useState<string[]>([]);

    const openChannel = async (name: string) => {
      if (roomIndex === -1) throw new Error("No room was selected");

      await p2party.openChannel(
        rooms[roomIndex].id,
        name,
        rooms[roomIndex].peers,
      );
    };

    const sendMessage = (message: string | File, channel: string) => {
      if (roomIndex === -1) throw new Error("No room was selected");

      p2party.sendMessage(message, channel, rooms[roomIndex].id, chunks);
    };

    const readMessage = async (merkleRootHex: string) => {
      return await p2party.readMessage(merkleRootHex);
    };

    const cancelMessage = async (
      channelLabel: string,
      merkleRootHex: string,
    ) => {
      return await p2party.cancelMessage(channelLabel, merkleRootHex);
    };

    const deleteMessage = async (merkleRootHex: string) => {
      return await p2party.deleteMessage(merkleRootHex);
    };

    useEffect(() => {
      // const abortController = new AbortController();

      // try {
      //   if (roomUrl && roomUrl.length > 0) {
      //     p2party.connect(roomUrl, signalingServerUrl, rtcConfig);
      //   }
      // } catch (error) {
      //   console.error(error);
      // }

      // return () => {
      //   abortController.abort();
      // };
      const i = rooms.findIndex((r) => r.url === roomUrl);
      if (i > -1 && rooms[i].id.length > 0) {
        setRoomIndex(i);

        setIceServers(
          rooms[i].rtcConfig.iceServers?.flatMap((server) =>
            Array.isArray(server.urls) ? server.urls : [server.urls],
          ) ?? [],
        );
      }
    }, [roomUrl, rooms]);

    return {
      keyPair,
      peerId: keyPair.peerId,
      roomId: roomIndex > -1 ? rooms[roomIndex].id : "",
      onlyConnectWithKnownPeers:
        roomIndex > -1 ? rooms[roomIndex].onlyConnectWithKnownAddresses : false,
      iceServers,
      signalingServerURL: signalingServerConnection.serverUrl,
      signalingServerConnectionState: signalingServerConnection,
      peers: roomIndex > -1 ? rooms[roomIndex].peers : [],
      channels: roomIndex > -1 ? rooms[roomIndex].channels : [],
      messages: roomIndex > -1 ? rooms[roomIndex].messages : [],
      selectedChannel,
      connect: p2party.connect,
      connectToSignalingServer: p2party.connectToSignalingServer,
      disconnect: p2party.disconnectFromRoom,
      disconnectFromSignalingServer: p2party.disconnectFromSignalingServer,
      disconnectFromRoom: p2party.disconnectFromRoom,
      disconnectFromPeer: p2party.disconnectFromPeer,
      setOnlyConnectToKnownPeers: p2party.onlyAllowConnectionsFromAddressBook,
      addPeerToAddressBook: p2party.addPeerToAddressBook,
      getPeerFromAddressBook: p2party.getPeerAddressBookEntry,
      removePeerFromAddressBook: p2party.deletePeerFromAddressBook,
      blacklistPeer: p2party.blacklistPeer,
      peerIsBlacklisted: p2party.getPeerIsBlacklisted,
      openChannel,
      selectChannel: setSelectedChannel,
      sendMessage,
      readMessage,
      cancelMessage,
      deleteMessage,
      purge: p2party.purge,
      purgeRoom: p2party.purgeRoom,
      purgeIdentity: p2party.purgeIdentity,
    };
  };
