import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "../dropdown";
import { NavbarItem } from "../navbar";

import { ArrowUturnLeftIcon, KeyIcon } from "@heroicons/react/16/solid";
import { IdentificationIcon } from "@heroicons/react/20/solid";

import type { Dispatch, FC, SetStateAction } from "react";

export interface IdentityDropdownProps {
  setShowIdentityBackup: Dispatch<SetStateAction<boolean>>;
  setShowIdentityRestore: Dispatch<SetStateAction<boolean>>;
}

/**
 * The navbar's copy of the identity menu, worded exactly like the sidebar's.
 *
 * This bar is the phone's chrome, and losing a phone is the reason a recovery
 * phrase exists, so the entry has to be reachable there without opening the
 * drawer first. Like the sidebar's, it is a sibling of the delete menu rather
 * than a section of it, and it leaves the dialogs to its parent: a Headless UI
 * menu unmounts its panel as it closes and would take an open dialog with it.
 */
const IdentityDropdown: FC<IdentityDropdownProps> = ({
  setShowIdentityBackup,
  setShowIdentityRestore,
}) => {
  return (
    <Dropdown>
      <DropdownButton
        as={NavbarItem}
        aria-label='identity backup and restore'
        title='Identity backup and restore'
      >
        <IdentificationIcon />
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
