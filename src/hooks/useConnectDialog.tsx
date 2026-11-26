import { useCallback } from "react";
import { useLocalStorage } from "usehooks-ts";

import {
  connectDialogDismissedKey,
  connectDialogOpenKey,
} from "../protocol/roomUiKeys";

/**
 * The join dialog's open/dismissed state, per room.
 *
 * Both flags live in localStorage so a reload does not re-ask a question the
 * user already answered. That also makes them the only channel through which
 * anything other than the layout can raise the dialog: `useLocalStorage`
 * broadcasts a write to every hook holding the same key in the document, so
 * the room view can ask for the dialog without the layout having to thread a
 * setter down through it.
 *
 * The keys are named by protocol/roomUiKeys, which keys them by a tag of the
 * room rather than by its capability. Flags an earlier build stored under a
 * capability have already been moved by the time this reads them: the app
 * entry scrubs them on every route before anything renders.
 */

export const useConnectDialog = (roomUrl: string | undefined) => {
  const [isOpen, setIsOpen] = useLocalStorage(
    connectDialogOpenKey(roomUrl),
    true,
  );
  const [wasDismissed, setWasDismissed] = useLocalStorage(
    connectDialogDismissedKey(roomUrl),
    true,
  );

  /**
   * Re-open the dialog after the user dismissed it. Clearing the dismissal is
   * the point: it is what "Cancel" set, and leaving it set would let the
   * layout's own effects treat this room as one the user has finished with.
   */
  const open = useCallback(() => {
    setWasDismissed(false);
    setIsOpen(true);
  }, [setIsOpen, setWasDismissed]);

  return { isOpen, setIsOpen, wasDismissed, setWasDismissed, open };
};
