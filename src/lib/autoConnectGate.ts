/**
 * The room auto-connect decision, lifted out of ChatLayout so it is testable.
 *
 * `attemptedRoomUrl` is the ref the layout keeps: "we already fired connect()
 * for this room URL". Before the C4 fix it was cleared only when connect()
 * rejected, so a socket that dropped AFTER a successful connect left the ref
 * set forever and the effect — which does re-run, isConnected is in its deps —
 * was blocked every time. A focused desktop tab therefore never reconnected.
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

/**
 * Release the recorded attempt exactly once per socket-down transition. The
 * caller runs this from an effect keyed on the two socket flags, so a repeated
 * failure cannot spin: connect()'s own rejection path opens the alert, which
 * shouldAutoConnect then blocks on.
 */
export const shouldReleaseAutoConnectAttempt = (
  input: Pick<
    AutoConnectGateInput,
    "isConnected" | "isEstablishingConnection" | "attemptedRoomUrl"
  >,
): boolean =>
  input.attemptedRoomUrl !== null &&
  !input.isConnected &&
  !input.isEstablishingConnection;
