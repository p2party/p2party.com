import { useState, useEffect } from "react";

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
  const {
    peerId,
    peers,
    addPeerToAddressBook,
    getPeerFromAddressBook,
    removePeerFromAddressBook,
    blacklistPeer,
    peerIsBlacklisted,
  } = useRoom();

  const [userInAddressBook, setUserInAddressBook] = useState(false);
  const [userInBlacklist, setUserInBlacklist] = useState(false);

  useEffect(() => {
    const checkIfSenderInLists = async () => {
      const peerInAddressBook = await getPeerFromAddressBook(
        message.fromPeerId,
      );

      if (peerInAddressBook) {
        setUserInAddressBook(true);
      } else {
        const peerInBlacklist = await peerIsBlacklisted(message.fromPeerId);

        if (peerInBlacklist) {
          setUserInBlacklist(true);
        }
      }
    };

    checkIfSenderInLists();
  }, [peers]);

  const handleAddPeerToAddressBook = async () => {
    const peerIndex = peers.findIndex((p) => p.peerId === message.fromPeerId);
    if (peerIndex > -1) {
      await addPeerToAddressBook(
        "No username found",
        peers[peerIndex].peerId,
        peers[peerIndex].peerPublicKey,
      );
    }
  };

  const handleBlacklisting = async () => {
    const peerIndex = peers.findIndex((p) => p.peerId === message.fromPeerId);
    if (peerIndex > -1) {
      await blacklistPeer(
        peers[peerIndex].peerId,
        peers[peerIndex].peerPublicKey,
      );
    } else {
      await blacklistPeer(message.fromPeerId, "");
    }
  };

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
            <div className='text-xs text-zinc-500 dark:text-zinc-400'>
              Username:
            </div>
            <div className='text-sm/7 font-semibold text-zinc-800 dark:text-white'>
              {message.fromPeerId.slice(0, 8)}
            </div>
          </div>
        </DropdownHeader>
        <DropdownDivider />

        {!userInAddressBook && message.fromPeerId !== peerId && (
          <DropdownItem onClick={handleAddPeerToAddressBook}>
            <UserPlusIcon />
            Add Contact
          </DropdownItem>
        )}

        {userInAddressBook && (
          <DropdownItem
            onClick={async () => await removePeerFromAddressBook("", "", "")}
          >
            <UserMinusIcon />
            Delete Contact
          </DropdownItem>
        )}

        {!userInBlacklist && message.fromPeerId !== peerId && (
          <DropdownItem onClick={handleBlacklisting}>
            <XMarkIcon />
            Blacklist Contact
          </DropdownItem>
        )}
      </DropdownMenu>
    </Dropdown>
  );
};

export default MessageSenderDropdown;
