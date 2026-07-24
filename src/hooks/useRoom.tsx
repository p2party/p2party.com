import { useMemo, useState, useCallback } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { useLocalStorage } from "usehooks-ts";

import p2party from "p2party";

import {
  getTransientRoomPin,
  getTransientRoomPolicy,
} from "../protocol/roomAccess";
import {
  immediateRoomPolicy,
  protocolV3,
  type MessageTransferHandle,
  type RoomPolicyV1,
} from "../protocol/v3";
import { useRoomInvite } from "./useRoomInvite";

import type { Message, Room, State } from "p2party";

export interface MessageWithData extends Message {
  data: string | File;
}

const EMPTY_PEERS: Room["peers"] = [];
const EMPTY_CHANNELS: Room["channels"] = [];
const EMPTY_MESSAGES: Message[] = [];

interface UseRoomOptions {
  /**
   * Message records change for every chunk/progress update. Most room chrome
   * does not render messages and should stay outside that hot subscription.
   */
  subscribeToMessages?: boolean;
}

export const DEFAULT_SIGNALING_URL = "wss://signaling.p2party.com/ws";
export const DEFAULT_STUN_URLS = ["stun:stun.p2party.com:3478"];

export const useRoom = ({
  subscribeToMessages = true,
}: UseRoomOptions = {}) => {
  const roomInvite = useRoomInvite();
  const roomUrl = roomInvite.kind === "valid" ? roomInvite.roomUrl : undefined;
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
  const roomView = useSelector((state: State) => {
    const room = p2party
      .roomSelector(state)
      .find((candidate) => candidate.url === roomUrl);
    return {
      exists: room !== undefined,
      id: room?.id ?? "",
      onlyConnectWithKnownAddresses:
        room?.onlyConnectWithKnownAddresses ?? false,
      policy: room?.policy,
      peers: room?.peers ?? EMPTY_PEERS,
      channels: room?.channels ?? EMPTY_CHANNELS,
    };
  }, shallowEqual);
  const messages = useSelector((state: State) => {
    if (!subscribeToMessages) return EMPTY_MESSAGES;
    return (
      p2party.roomSelector(state).find((candidate) => candidate.url === roomUrl)
        ?.messages ?? EMPTY_MESSAGES
    );
  });
  const signalingServerConnection = useSelector(
    p2party.signalingServerSelector,
  );

  const [selectedChannel, setSelectedChannel] = useState("main");
  const transientPolicy = roomUrl ? getTransientRoomPolicy(roomUrl) : undefined;
  const retainedPolicy = roomView.policy ?? transientPolicy;
  const policyMismatch = useMemo(() => {
    if (roomInvite.kind !== "valid" || retainedPolicy === undefined) return "";
    if (
      roomInvite.specifiedPolicy.authMode &&
      retainedPolicy.authMode !== roomInvite.policy.authMode
    )
      return "Room invitation authentication mode conflicts with the saved room policy";
    if (
      roomInvite.specifiedPolicy.pqMode &&
      retainedPolicy.pqMode !== roomInvite.policy.pqMode
    )
      return "Room invitation ML-KEM suite conflicts with the saved room policy";
    if (
      roomInvite.specifiedPolicy.wireVersion &&
      retainedPolicy.wireVersion !== roomInvite.policy.wireVersion
    )
      return "Room invitation protocol version conflicts with the saved room policy";
    return "";
  }, [retainedPolicy, roomInvite]);
  const roomInviteError =
    roomInvite.kind === "invalid" ? roomInvite.error : policyMismatch;
  const roomPolicy = useMemo<RoomPolicyV1>(() => {
    return (
      retainedPolicy ??
      (roomInvite.kind === "valid" ? roomInvite.policy : undefined) ??
      immediateRoomPolicy("nopin")
    );
  }, [retainedPolicy, roomInvite]);

  const connectToRoom = useCallback(
    async (roomUrl: string) => {
      if (roomInviteError.length > 0) throw new Error(roomInviteError);
      const canonicalRoomUrl = p2party.normalizeRoomCapability(roomUrl);
      const rtcConfig: RTCConfiguration = {
        iceServers: stunServerUrls.length > 0 ? [{ urls: stunServerUrls }] : [],
        iceTransportPolicy: "all" as RTCIceTransportPolicy,
      };
      const policy =
        getTransientRoomPolicy(canonicalRoomUrl) ??
        roomView.policy ??
        (roomInvite.kind === "valid"
          ? roomInvite.policy
          : immediateRoomPolicy("nopin"));
      const pin =
        policy.authMode === "pin"
          ? getTransientRoomPin(canonicalRoomUrl)
          : undefined;

      if (policy.authMode === "pin" && !pin)
        throw new Error("Enter the room PIN before connecting");

      try {
        await protocolV3.connect(
          canonicalRoomUrl,
          signalingServerUrl,
          rtcConfig,
          { policy, pin },
        );
      } finally {
        pin?.fill(0);
      }
    },
    [
      roomInvite,
      roomInviteError,
      roomView.policy,
      signalingServerUrl,
      stunServerUrls,
    ],
  );

  const connectToSignaling = useCallback(
    async (roomUrl: string) => {
      const canonicalRoomUrl = p2party.normalizeRoomCapability(roomUrl);
      // The first contact establishes an immutable authenticated room policy.
      // Never let a PIN invitation fall through the legacy policy-less path.
      if (!roomView.exists) {
        await connectToRoom(canonicalRoomUrl);
        return;
      }
      await p2party.connectToSignalingServer(
        canonicalRoomUrl,
        signalingServerUrl,
      );
    },
    [connectToRoom, roomView.exists, signalingServerUrl],
  );

  const sendMessage = useCallback(
    (message: string | File, channel: string): MessageTransferHandle => {
      if (!roomView.id) throw new Error("No room was selected");

      return protocolV3.sendMessage(
        message,
        channel,
        roomView.id,
        Math.min(99, Math.max(1, percentageFilledChunk)) / 100,
        chunks,
      );
    },
    [chunks, percentageFilledChunk, roomView.id],
  );

  return {
    roomUrl,
    roomInviteError,
    keyPair,
    peerId: keyPair.peerId,
    roomId: roomView.id,
    onlyConnectWithKnownPeers: roomView.onlyConnectWithKnownAddresses,
    roomPolicy,
    signalingServerUrl,
    setSignalingServerUrl,
    stunServerUrls,
    setStunServerUrls,
    signalingServerConnectionState: signalingServerConnection,
    peers: roomView.peers,
    channels: roomView.channels,
    messages,
    selectedChannel,
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
