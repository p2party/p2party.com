import {
  immediateRoomPolicy,
  type RoomAuthMode,
  type RoomPolicyV1,
} from "./v3";

const transientPins = new Map<string, Uint8Array>();
const transientPolicies = new Map<string, RoomPolicyV1>();

const copyPolicy = (policy: RoomPolicyV1): RoomPolicyV1 => ({ ...policy });

export const rememberRoomAccess = (
  roomUrl: string,
  policy: RoomPolicyV1,
  pin?: Uint8Array,
): void => {
  transientPolicies.set(roomUrl, copyPolicy(policy));

  const previous = transientPins.get(roomUrl);
  previous?.fill(0);
  transientPins.delete(roomUrl);

  if (policy.authMode === "pin") {
    if (!(pin instanceof Uint8Array) || pin.length === 0)
      throw new Error("A PIN is required for this room");
    transientPins.set(roomUrl, Uint8Array.from(pin));
  } else if (pin !== undefined) {
    throw new Error("A no-PIN room cannot retain a PIN");
  }
};

export const getTransientRoomPin = (
  roomUrl: string,
): Uint8Array | undefined => {
  const pin = transientPins.get(roomUrl);
  return pin ? Uint8Array.from(pin) : undefined;
};

export const hasTransientRoomPin = (roomUrl: string): boolean =>
  transientPins.has(roomUrl);

export const getTransientRoomPolicy = (
  roomUrl: string,
): RoomPolicyV1 | undefined => {
  const policy = transientPolicies.get(roomUrl);
  return policy ? copyPolicy(policy) : undefined;
};

export const forgetRoomAccess = (roomUrl: string): void => {
  transientPins.get(roomUrl)?.fill(0);
  transientPins.delete(roomUrl);
  transientPolicies.delete(roomUrl);
};

export const clearTransientRoomAccess = (): void => {
  for (const pin of transientPins.values()) pin.fill(0);
  transientPins.clear();
  transientPolicies.clear();
};

export const authModeFromInvite = (search: string): RoomAuthMode => {
  const auth = new URLSearchParams(search).get("auth");
  return auth === "pin" ? "pin" : "nopin";
};

export const policyFromInvite = (search: string): RoomPolicyV1 =>
  immediateRoomPolicy(authModeFromInvite(search));

export const roomInvitePath = (
  roomUrl: string,
  policy: Pick<RoomPolicyV1, "authMode" | "wireVersion">,
): string => {
  const params = new URLSearchParams({ v: String(policy.wireVersion) });
  if (policy.authMode === "pin") params.set("auth", "pin");
  return `/rooms/${roomUrl}?${params.toString()}`;
};

export const absoluteRoomInviteUrl = (
  roomUrl: string,
  policy: Pick<RoomPolicyV1, "authMode" | "wireVersion">,
): string => {
  const path = roomInvitePath(roomUrl, policy);
  return new URL(path, window.location.origin).toString();
};

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", clearTransientRoomAccess);
}
