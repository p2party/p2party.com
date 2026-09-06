import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "../dropdown";
import { SidebarItem } from "../sidebar";

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
 * The sidebar's copy of the delete menu, worded exactly like the navbar's and
 * running the same hook. Only the trigger chrome differs.
 *
 * Everything the navbar copy's comment says applies here: the rows report
 * through usePurge instead of dropping the promise on the floor, and PurgeAlert
 * is a sibling of the menu rather than a child of it.
 */
const DeleteDropdown = () => {
  const { roomUrl, keyPair, roomId } = useRoom({ subscribeToMessages: false });
  const { pending, outcome, run, retry, dismiss } = usePurge(roomUrl);

  return (
    <>
      <Dropdown>
        <DropdownButton as={SidebarItem}>
          <span className='flex min-w-0 items-center gap-3'>
            <TrashIcon className='size-9 lg:size-7' />
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-100'>
                Delete:
              </span>
              <span className='block truncate font-mono text-xs/5 font-normal text-zinc-400'>
                Room, Identity, everything
              </span>
            </span>
          </span>
        </DropdownButton>
        <DropdownMenu className='min-w-64' anchor='bottom start'>
          {keyPair.publicKey.length === 64 && (
            <DropdownItem onClick={() => run("identity")}>
              <UserMinusIcon />
              Purge Identity
            </DropdownItem>
          )}

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
