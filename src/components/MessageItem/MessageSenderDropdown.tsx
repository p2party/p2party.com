import { Avatar } from "../avatar";
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
  DropdownHeader,
  DropdownDivider,
} from "../dropdown";
import {
  UserMinusIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";

import { useRoom } from "../../hooks/useRoom";

import type { Message } from "p2party";

export interface MessageSenderDropdownProps {
  message: Message;
}

const MessageSenderDropdown = ({ message }: MessageSenderDropdownProps) => {
  const { peerId } = useRoom();
  return (
    <Dropdown>
      <DropdownButton plain>
        <>
          {message.fromPeerId !== peerId && (
            <Avatar
              initials={message.fromPeerId.slice(
                message.fromPeerId.length - 2,
                message.fromPeerId.length,
              )}
              className='w-10 flex-shrink-0 rounded-full'
            />
          )}

          {message.fromPeerId === peerId && (
            <Avatar
              initials={message.fromPeerId.slice(
                message.fromPeerId.length - 2,
                message.fromPeerId.length,
              )}
              className='w-10 flex-shrink-0 rounded-full'
            />
          )}
        </>
      </DropdownButton>

      <DropdownMenu
        className='min-w-64'
        anchor={message.fromPeerId !== peerId ? "bottom start" : "bottom end"}
      >
        <DropdownHeader>
          <div className='pr-6'>
            {/* <div className="text-xs text-zinc-500 dark:text-zinc-400">Signed in as Tom Cook</div> */}
            <div className='text-sm/7 font-semibold text-zinc-800 dark:text-white'>
              No username found
            </div>
          </div>
        </DropdownHeader>
        <DropdownDivider />
        <DropdownItem>
          <UserPlusIcon />
          Add Contact
        </DropdownItem>

        <DropdownItem>
          <UserMinusIcon />
          Delete Contact
        </DropdownItem>

        <DropdownItem>
          <XMarkIcon />
          Blacklist Contact
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};

export default MessageSenderDropdown;
