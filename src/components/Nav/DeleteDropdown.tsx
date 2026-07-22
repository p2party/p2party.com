import { useParams } from "react-router";
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

import { useRoom } from "../../hooks/useRoom";
import { TrashIcon } from "@heroicons/react/20/solid";

const DeleteDropdown = () => {
  const { keyPair, roomId, purge, purgeIdentity, purgeRoom } = useRoom();
  const { roomUrl } = useParams();

  return (
    <Dropdown>
      <DropdownButton as={NavbarItem}>
        <TrashIcon />
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
