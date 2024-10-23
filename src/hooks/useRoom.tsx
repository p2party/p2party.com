// import { useEffect } from "react";
// import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import p2party from "p2party";

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
    // const { roomUrl } = useParams();

    const keyPair = useSelector(p2party.keyPairSelector);
    const room = useSelector(p2party.roomSelector);
    const signalingServerConnection = useSelector(
      p2party.signalingServerSelector,
    );

    const openChannel = async (name: string) => {
      await p2party.openChannel(name, room.peers);
    };

    const sendMessage = (message: string, channel?: string) => {
      if (message.length > 0) p2party.sendMessage(message, channel);
    };

    // useEffect(() => {
    //   const abortController = new AbortController();
    //
    //   try {
    //     if (roomUrl && roomUrl.length > 0) {
    //       p2party.connect(roomUrl, signalingServerUrl, rtcConfig);
    //     }
    //   } catch (error) {
    //     console.error(error);
    //   }
    //
    //   return () => {
    //     abortController.abort();
    //   };
    // }, [roomUrl]);

    return {
      keyPair,
      connect: p2party.connect,
      disconnect: p2party.disconnectFromRoom,
      disconnectFromSignalingServer: p2party.disconnectFromSignalingServer,
      peerId: keyPair.peerId,
      roomId: room.id,
      signalingServerConnectionState: signalingServerConnection,
      peers: room.peers,
      channels: room.channels,
      messages: room.messages,
      openChannel,
      sendMessage,
    };
  };
