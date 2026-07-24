import p2party from "p2party";

import type {
  MessageTransferHandle as PackageMessageTransferHandle,
  RoomPolicyV1,
} from "p2party";

export type { RoomPolicyV1 };
export type RoomAuthMode = RoomPolicyV1["authMode"];
export type RoomCoverMode = RoomPolicyV1["coverMode"];
export type MessageTransferHandle = PackageMessageTransferHandle;
export type SendMessageResult = Exclude<
  Awaited<PackageMessageTransferHandle["done"]>,
  undefined
>;
export type PeerDeliveryOutcome = SendMessageResult["outcomes"][number];

/**
 * Keep the version-specific calls visible at the integration boundary. These
 * are direct, declaration-checked 0.10.0 exports—not a compatibility shim.
 */
export const protocolV3 = {
  connect: p2party.connect,
  sendMessage: p2party.sendMessage,
};

export const immediateRoomPolicy = (
  authMode: RoomAuthMode,
): RoomPolicyV1 => ({
  version: 1,
  revision: 0,
  wireVersion: 3,
  authMode,
  pqMode: "hybrid-mlkem768",
  rendezvousMode: "legacy-signaling",
  coverMode: "immediate",
  coverCadenceMs: 0,
  coverLanes: 0,
  coverFramesPerCell: 0,
  coverDurationEpochs: 0,
});
