import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "../dropdown";
import { SidebarItem } from "../sidebar";

import { ArrowUturnLeftIcon, KeyIcon } from "@heroicons/react/16/solid";
import { IdentificationIcon } from "@heroicons/react/20/solid";

import type { Dispatch, FC, SetStateAction } from "react";

export interface IdentityDropdownProps {
  setShowIdentityBackup: Dispatch<SetStateAction<boolean>>;
  setShowIdentityRestore: Dispatch<SetStateAction<boolean>>;
}

/**
 * The two ways in and out of an identity: write down the phrase that restores
 * it, or type that phrase back in.
 *
 * A sibling of the delete menu, not a section of it. That menu is destruction —
 * purge the identity, the room, everything — and the row that hands a lost
 * identity back does not belong one tap away from the row that destroys it.
 *
 * The dialogs are the parent's to mount. A Headless UI menu unmounts its panel
 * as it closes, so a dialog opened from inside this tree would be torn down in
 * the same frame it appeared.
 */
const IdentityDropdown: FC<IdentityDropdownProps> = ({
  setShowIdentityBackup,
  setShowIdentityRestore,
}) => {
  return (
    <Dropdown>
      <DropdownButton as={SidebarItem}>
        <span className='flex min-w-0 items-center gap-3'>
          <IdentificationIcon className='size-9 lg:size-7' />
          <span className='min-w-0'>
            <span className='block truncate text-sm/5 font-medium text-zinc-100'>
              Identity:
            </span>
            <span className='block truncate font-mono text-xs/5 font-normal text-zinc-400'>
              Back up, restore
            </span>
          </span>
        </span>
      </DropdownButton>
      <DropdownMenu className='min-w-64' anchor='bottom start'>
        <DropdownItem onClick={() => setShowIdentityBackup(true)}>
          <KeyIcon />
          Back up identity
        </DropdownItem>

        <DropdownItem onClick={() => setShowIdentityRestore(true)}>
          <ArrowUturnLeftIcon />
          Restore identity
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};

export default IdentityDropdown;
