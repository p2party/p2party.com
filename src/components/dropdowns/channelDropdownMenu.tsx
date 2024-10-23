import { DropdownMenu, DropdownItem } from "../dropdown";
import {
  PlusIcon,
  MagnifyingGlassIcon as MagnifyingGlassIcon16,
  MinusIcon,
  StopIcon,
} from "@heroicons/react/16/solid";

const ChannelDropdownMenu = () => {
  return (
    <DropdownMenu className='min-w-64' anchor='bottom start'>
      <DropdownItem>
        <MagnifyingGlassIcon16 />
        Search channel
      </DropdownItem>

      <DropdownItem>
        <PlusIcon />
        New channel
      </DropdownItem>

      <DropdownItem>
        <MinusIcon />
        Exit channel
      </DropdownItem>

      <DropdownItem>
        <StopIcon />
        Block channel
      </DropdownItem>
    </DropdownMenu>
  );
};

export default ChannelDropdownMenu;
