/**
 * The room auto-connect decision, lifted out of ChatLayout so it is testable.
 *
 * The layout owns room admission; SDK 0.14.8 owns reconnection after admission.
 * Clearing the admission on socket loss bypasses the SDK's backoff and its
 * terminal 1008 refusal, so two tabs can evict one another hundreds of times.
 */

export interface AutoConnectGateInput {
  readonly roomUrl: string | undefined;
  readonly roomInviteErrorLength: number;
  readonly pinRequired: boolean;
  readonly hasPin: boolean;
  readonly pressedCancelInConnect: boolean;
  readonly alertIsOpen: boolean;
  readonly isConnected: boolean;
  readonly isEstablishingConnection: boolean;
  readonly attemptedRoomUrl: string | null;
}

export const shouldAutoConnect = (input: AutoConnectGateInput): boolean =>
  input.roomUrl !== undefined &&
  input.roomUrl.length > 0 &&
  input.roomInviteErrorLength === 0 &&
  (!input.pinRequired || input.hasPin) &&
  !input.pressedCancelInConnect &&
  !input.alertIsOpen &&
  !input.isConnected &&
  !input.isEstablishingConnection &&
  input.attemptedRoomUrl !== input.roomUrl;

/** Advance the actual admission latch for one layout effect pass. */
export const advanceAutoConnectAttempt = (
  input: AutoConnectGateInput,
): { attemptedRoomUrl: string | null; shouldConnect: boolean } => {
  // Manual Connect bypasses the auto-connect branch. Observe its socket as
  // well, or its first later disconnect would still trigger an automatic retry.
  const admittedRoom =
    input.roomUrl && (input.isConnected || input.isEstablishingConnection)
      ? input.roomUrl
      : input.attemptedRoomUrl;
  const shouldConnect = shouldAutoConnect({
    ...input,
    attemptedRoomUrl: admittedRoom,
  });
  return {
    shouldConnect,
    attemptedRoomUrl:
      input.alertIsOpen || input.pressedCancelInConnect
        ? null
        : shouldConnect
          ? (input.roomUrl ?? null)
          : admittedRoom,
  };
};
