import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "../dropdown";
import { NavbarItem } from "../navbar";

import {
  UserMinusIcon,
  ScissorsIcon,
  FireIcon,
} from "@heroicons/react/16/solid";

import PurgeAlert from "../alerts/PurgeAlert";

import { useRoom } from "../../hooks/useRoom";
import { usePurge } from "../../hooks/usePurge";
import { TrashIcon } from "@heroicons/react/20/solid";

/**
 * The three purges, and what they did.
 *
 * The rows used to hand `purgeIdentity`, `purgeRoom` and `purge` straight to
 * onClick, which discarded the promise each returned. With no unhandledrejection
 * listener and no error boundary in this app, a purge that only half settled
 * reported nothing -- while the screen reported success anyway, because the
 * identity reset and the room delete both land before the durable deletions are
 * awaited, so the row that was clicked vanishes either way.
 *
 * `usePurge` runs them and keeps the outcome; PurgeAlert says what happened.
 * The state lives here rather than in the chrome because the work outlives the
 * click that started it and this component is what survives the menu closing.
 * The dialog is mounted beside the menu, not inside it: a Headless UI menu
 * unmounts its panel as it closes and would take the report with it.
 *
 * The sidebar carries the same menu, worded the same, over the same hook.
 */
const DeleteDropdown = () => {
  const { roomUrl, keyPair, roomId } = useRoom({ subscribeToMessages: false });
  const { pending, outcome, run, retry, dismiss } = usePurge(roomUrl);

  return (
    <>
      <Dropdown>
        <DropdownButton
          as={NavbarItem}
          aria-label='Delete messages or rooms'
          title='Delete messages or rooms'
        >
          <TrashIcon />
        </DropdownButton>
        <DropdownMenu className='min-w-64' anchor='bottom start'>
          {keyPair.publicKey.length === 64 && (
            <DropdownItem onClick={() => run("identity")}>
              <UserMinusIcon />
              Purge Identity
            </DropdownItem>
          )}

          {/* A room id only exists for a room this tab has open, so the URL is
              there too. Asking for both keeps the capability check in the SDK
              from being the thing that reports an empty string back. */}
          {roomId.length > 0 && roomUrl !== undefined && (
            <DropdownItem onClick={() => run("room")}>
              <ScissorsIcon />
              Purge Room Data
            </DropdownItem>
          )}

          <DropdownItem onClick={() => run("everything")}>
            <FireIcon />
            Purge All Data
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      <PurgeAlert
        pending={pending}
        outcome={outcome}
        onRetry={retry}
        onClose={dismiss}
      />
    </>
  );
};

export default DeleteDropdown;
