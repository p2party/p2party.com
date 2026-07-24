import p2party from "p2party";

import type {
  MessageTransferHandle as PackageMessageTransferHandle,
  RoomPolicyV1,
} from "p2party";

export type { RoomPolicyV1 };
export type RoomAuthMode = RoomPolicyV1["authMode"];
export type RoomCoverMode = RoomPolicyV1["coverMode"];
export type RoomPqMode = RoomPolicyV1["pqMode"];
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
  pqMode: RoomPqMode = "hybrid-mlkem768",
): RoomPolicyV1 => ({
  version: 1,
  revision: 0,
  wireVersion: 3,
  authMode,
  pqMode,
  rendezvousMode: "legacy-signaling",
  coverMode: "immediate",
  coverCadenceMs: 0,
  coverLanes: 0,
  coverFramesPerCell: 0,
  coverDurationEpochs: 0,
});

export const roomPqModeParameterSet = (
  pqMode: RoomPqMode,
): 512 | 768 | 1024 => {
  if (pqMode === "hybrid-mlkem512") return 512;
  if (pqMode === "hybrid-mlkem768") return 768;
  return 1024;
};
