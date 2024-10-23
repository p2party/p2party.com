import { DropdownMenu, DropdownItem } from "../dropdown";
import {
  PlusIcon,
  MagnifyingGlassIcon as MagnifyingGlassIcon16,
  MinusIcon,
  StopIcon,
} from "@heroicons/react/16/solid";

const PeerDropdownMenu = () => {
  return (
    <DropdownMenu className='min-w-64' anchor='bottom start'>
      <DropdownItem>
        <MagnifyingGlassIcon16 />
        Search peers
      </DropdownItem>

      <DropdownItem>
        <PlusIcon />
        Add peer
      </DropdownItem>

      <DropdownItem>
        <MinusIcon />
        Remove peer
      </DropdownItem>

      <DropdownItem>
        <StopIcon />
        Block peer
      </DropdownItem>
    </DropdownMenu>
  );
};

export default PeerDropdownMenu;
