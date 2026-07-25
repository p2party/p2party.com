import p2party from "p2party";

import type {
  MessageTransferHandle as PackageMessageTransferHandle,
  Room,
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
 * Live per-edge scheduled-cover state as reported by the library runtime
 * (rooms[].coverStatusByPeer). Absent means no cover claim may ever be made
 * for that edge; only an explicit "active" is a cover claim.
 */
export type RoomCoverStatus = NonNullable<Room["coverStatusByPeer"]>[string];

/**
 * Keep the version-specific calls visible at the integration boundary. These
 * are direct, declaration-checked 0.13.0 exports—not a compatibility shim.
 */
export const protocolV4 = {
  connect: p2party.connect,
  sendMessage: p2party.sendMessage,
};

export const immediateRoomPolicy = (
  authMode: RoomAuthMode,
  pqMode: RoomPqMode = "hybrid-mlkem768",
): RoomPolicyV1 => ({
  version: 1,
  revision: 0,
  wireVersion: 4,
  authMode,
  pqMode,
  rendezvousMode: "legacy-signaling",
  coverMode: "immediate",
  coverCadenceMs: 0,
  coverLanes: 0,
  coverFramesPerCell: 0,
  coverDurationEpochs: 0,
});

export interface ScheduledCoverPreset {
  id: "10s" | "60s" | "5min";
  label: string;
  description: string;
  coverCadenceMs: number;
  coverLanes: number;
  coverFramesPerCell: number;
  coverDurationEpochs: number;
}

/**
 * UI presets for scheduled timing cover. Every entry satisfies the library's
 * policy validation (cadence within [MIN_COVER_CADENCE_MS,
 * MAX_COVER_CADENCE_MS], lanes ≤ MAX_COVER_LANES, frames ≤
 * MAX_COVER_FRAMES_PER_CELL, and cadence / (lanes × frames) ≥
 * MIN_COVER_SLOT_MS) — asserted by tests against the real
 * validateRoomPolicyV1 round-trip.
 */
export const SCHEDULED_COVER_PRESETS: readonly ScheduledCoverPreset[] = [
  {
    id: "10s",
    label: "10 s cycles",
    description: "≈2 MB of uniform cells every 10 seconds per peer",
    coverCadenceMs: 10_000,
    coverLanes: 2,
    coverFramesPerCell: 16,
    coverDurationEpochs: 1,
  },
  {
    id: "60s",
    label: "60 s cycles",
    description: "≈4 MB of uniform cells every minute per peer",
    coverCadenceMs: 60_000,
    coverLanes: 2,
    coverFramesPerCell: 32,
    coverDurationEpochs: 1,
  },
  {
    id: "5min",
    label: "5 min cycles",
    description: "≈8 MB of uniform cells every 5 minutes per peer",
    coverCadenceMs: 300_000,
    coverLanes: 2,
    coverFramesPerCell: 64,
    coverDurationEpochs: 1,
  },
];

export const scheduledCoverPresetById = (
  id: string,
): ScheduledCoverPreset | undefined =>
  SCHEDULED_COVER_PRESETS.find((preset) => preset.id === id);

/** The preset whose schedule matches the policy exactly, if any. */
export const scheduledCoverPresetOfPolicy = (
  policy: RoomPolicyV1,
): ScheduledCoverPreset | undefined =>
  policy.coverMode === "scheduled"
    ? SCHEDULED_COVER_PRESETS.find(
        (preset) =>
          preset.coverCadenceMs === policy.coverCadenceMs &&
          preset.coverLanes === policy.coverLanes &&
          preset.coverFramesPerCell === policy.coverFramesPerCell &&
          preset.coverDurationEpochs === policy.coverDurationEpochs,
      )
    : undefined;

export const scheduledRoomPolicy = (
  authMode: RoomAuthMode,
  pqMode: RoomPqMode,
  preset: ScheduledCoverPreset,
): RoomPolicyV1 => ({
  version: 1,
  revision: 0,
  wireVersion: 4,
  authMode,
  pqMode,
  rendezvousMode: "legacy-signaling",
  coverMode: "scheduled",
  coverCadenceMs: preset.coverCadenceMs,
  coverLanes: preset.coverLanes,
  coverFramesPerCell: preset.coverFramesPerCell,
  coverDurationEpochs: preset.coverDurationEpochs,
});

export const roomPqModeParameterSet = (
  pqMode: RoomPqMode,
): 512 | 768 | 1024 => {
  if (pqMode === "hybrid-mlkem512") return 512;
  if (pqMode === "hybrid-mlkem768") return 768;
  return 1024;
};

/** Short human label for a policy's traffic mode ("immediate" / "10 s cycles"). */
export const coverModeSummary = (policy: RoomPolicyV1): string => {
  if (policy.coverMode !== "scheduled") return "immediate delivery";
  const preset = scheduledCoverPresetOfPolicy(policy);
  if (preset) return `scheduled cover, ${preset.label}`;
  return `scheduled cover, ${String(policy.coverCadenceMs)} ms cadence`;
};
