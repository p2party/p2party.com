import { useMemo, useState, useCallback } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { useLocalStorage } from "usehooks-ts";

import p2party from "../protocol/sdk";

import {
  createRecoverableIdentity,
  getIdentityBackupStatus,
  identityBackupIsAvailable,
  identityIsRecoverable,
  isInvalidRecoveryPhraseError,
  restoreIdentityFromMnemonic,
  validateMnemonicWords,
} from "../protocol/identityBackup";
import {
  getTransientRoomPin,
  getTransientRoomPolicy,
} from "../protocol/roomAccess";
import {
  immediateRoomPolicy,
  protocolV4,
  type MessageTransferHandle,
  type RoomPolicyV1,
} from "../protocol/v4";
import { useRoomInvite } from "./useRoomInvite";

import type { Message, Room, State } from "p2party";

export interface MessageWithData extends Message {
  data: string | File;
}

const EMPTY_PEERS: Room["peers"] = [];
const EMPTY_CHANNELS: Room["channels"] = [];
const EMPTY_MESSAGES: Message[] = [];
const EMPTY_COVER_STATUS: NonNullable<Room["coverStatusByPeer"]> = {};
const EMPTY_HANDSHAKE_STATUS: NonNullable<Room["handshakeStatusByPeer"]> = {};

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
      id: room?.id ?? "",
      onlyConnectWithKnownAddresses:
        room?.onlyConnectWithKnownAddresses ?? false,
      policy: room?.policy,
      peers: room?.peers ?? EMPTY_PEERS,
      channels: room?.channels ?? EMPTY_CHANNELS,
      coverStatusByPeer: room?.coverStatusByPeer ?? EMPTY_COVER_STATUS,
      handshakeStatusByPeer:
        room?.handshakeStatusByPeer ?? EMPTY_HANDSHAKE_STATUS,
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
    if (
      roomInvite.specifiedPolicy.coverMode &&
      (retainedPolicy.coverMode !== roomInvite.policy.coverMode ||
        retainedPolicy.coverCadenceMs !== roomInvite.policy.coverCadenceMs ||
        retainedPolicy.coverLanes !== roomInvite.policy.coverLanes ||
        retainedPolicy.coverFramesPerCell !==
          roomInvite.policy.coverFramesPerCell ||
        retainedPolicy.coverDurationEpochs !==
          roomInvite.policy.coverDurationEpochs)
    )
      return "Room invitation traffic-cover schedule conflicts with the saved room policy";
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
        await protocolV4.connect(
          canonicalRoomUrl,
          signalingServerUrl,
          rtcConfig,
          { policy, pin },
        );
      } catch (cause) {
        // The library fail-closes on a persisted pre-v4 room policy (it will
        // not silently discard a stored policy — that could downgrade a PIN
        // room). Translate the raw codec error into an actionable message.
        if (
          cause instanceof Error &&
          /unsupported wire version|invalid encoded policy/i.test(cause.message)
        )
          throw Object.assign(
            new Error(
              "This room was saved by the retired protocol v3 build and cannot reconnect under protocol v4. Create a fresh room, or purge this one from the saved rooms list.",
            ),
            { cause },
          );
        throw cause;
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
    async (roomUrl: string) => await connectToRoom(roomUrl),
    [connectToRoom],
  );

  const sendMessage = useCallback(
    (message: string | File, channel: string): MessageTransferHandle => {
      if (!roomView.id) throw new Error("No room was selected");

      return protocolV4.sendMessage(
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
    /**
     * The peers a message would actually reach right now.
     *
     * `peers` is the signaling roster: who the server says is in the room. The
     * library refuses to send to a peer whose protocol-v4 handshake has not
     * completed, so a roster count answers "who is here" while a send answers
     * "who can hear me", and the two disagree whenever an edge is still
     * handshaking or has dropped. Counting the roster told people two peers
     * were connected and then failed the send with `not-connected`.
     */
    reachablePeers: roomView.peers.filter(
      (peer) =>
        roomView.handshakeStatusByPeer[peer.peerId]?.status === "authenticated",
    ),
    channels: roomView.channels,
    coverStatusByPeer: roomView.coverStatusByPeer,
    handshakeStatusByPeer: roomView.handshakeStatusByPeer,
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
    /**
     * Identity backup and restore. Only an identity created from a recovery
     * phrase can be restored from one, so `getIdentityBackupStatus` is what
     * says whether this device's identity can be backed up at all — read its
     * answer through `identityIsRecoverable`, because an identity that predates
     * this feature reports a `null` derivation rather than "random" — and
     * `createRecoverableIdentity` is how an unrecoverable one is replaced by
     * one that can be, at the cost of a new identity key, which peers will see
     * as an identity change. Both leave signaling disconnected: call `connect`
     * afterwards.
     */
    identityBackupIsAvailable,
    getIdentityBackupStatus,
    identityIsRecoverable,
    createRecoverableIdentity,
    restoreIdentityFromMnemonic,
    validateMnemonicWords,
    isInvalidRecoveryPhraseError,
  };
};
