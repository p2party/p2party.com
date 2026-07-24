import { useParams } from "react-router";
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

import { useRoom } from "../../hooks/useRoom";
import { TrashIcon } from "@heroicons/react/20/solid";

const DeleteDropdown = () => {
  const { keyPair, roomId, purge, purgeIdentity, purgeRoom } = useRoom({
    subscribeToMessages: false,
  });
  const { roomUrl } = useParams();

  return (
    <Dropdown>
      <DropdownButton as={SidebarItem}>
        <span className='flex min-w-0 items-center gap-3'>
          <TrashIcon className='size-9 lg:size-7' />
          <span className='min-w-0'>
            <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
              Delete:
            </span>
            <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
              Room, Identity, everything
            </span>
          </span>
        </span>
      </DropdownButton>
      <DropdownMenu className='min-w-64' anchor='bottom start'>
        {keyPair.publicKey.length === 64 && (
          <DropdownItem onClick={purgeIdentity}>
            <UserMinusIcon />
            Purge Identity
          </DropdownItem>
        )}

        {roomId.length > 0 && (
          <DropdownItem onClick={async () => await purgeRoom(roomUrl ?? "")}>
            <ScissorsIcon />
            Purge Room Data
          </DropdownItem>
        )}

        <DropdownItem onClick={purge}>
          <FireIcon />
          Purge All Data
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};

export default DeleteDropdown;
