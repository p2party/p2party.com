import { useState, useEffect, memo } from "react";
import { useSelector } from "react-redux";
import p2party from "p2party";

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

import type { Message } from "p2party";

export interface MessageSenderDropdownProps {
  message: Message;
}

const MessageSenderDropdown = ({ message }: MessageSenderDropdownProps) => {
  // Narrow subscription: peerId only. The address-book / blacklist functions are
  // stable module fns, and the peer's public key is looked up from the store at
  // click time — so this row never re-renders on peer/message churn.
  const peerId = useSelector(p2party.keyPairSelector).peerId;

  const [userInAddressBook, setUserInAddressBook] = useState(false);
  const [userInBlacklist, setUserInBlacklist] = useState(false);

  // Find the sender peer (for its public key) across the current rooms — read
  // lazily from the store so no render subscription to `peers` is needed.
  const findSenderPeer = () => {
    const rooms = p2party.roomSelector(p2party.store.getState());
    for (const room of rooms) {
      const peer = room.peers.find((p) => p.peerId === message.fromPeerId);
      if (peer) return peer;
    }
    return undefined;
  };

  useEffect(() => {
    let cancelled = false;

    const checkIfSenderInLists = async () => {
      try {
        const peerInAddressBook = await p2party.getPeerAddressBookEntry(
          message.fromPeerId,
        );
        if (cancelled) return;

        if (peerInAddressBook) {
          setUserInAddressBook(true);
        } else {
          const peerInBlacklist = await p2party.getPeerIsBlacklisted(
            message.fromPeerId,
          );
          if (!cancelled && peerInBlacklist) setUserInBlacklist(true);
        }
      } catch (error) {
        console.error(error);
      }
    };

    checkIfSenderInLists();

    return () => {
      cancelled = true;
    };
    // Re-check only when the sender identity changes — not on every peer-list
    // mutation (which fired an async DB read for every message).
  }, [message.fromPeerId]);

  const handleAddPeerToAddressBook = async () => {
    const peer = findSenderPeer();
    if (peer)
      await p2party.addPeerToAddressBook(
        "No username found",
        peer.peerId,
        peer.peerPublicKey,
      );
  };

  const handleBlacklisting = async () => {
    const peer = findSenderPeer();
    if (peer) await p2party.blacklistPeer(peer.peerId, peer.peerPublicKey);
    else await p2party.blacklistPeer(message.fromPeerId, "");
  };

  return (
    <Dropdown>
      <DropdownButton plain>
        <Avatar
          initials={message.fromPeerId.slice(
            message.fromPeerId.length - 2,
            message.fromPeerId.length,
          )}
          className='w-10 shrink-0 rounded-full'
        />
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
            onClick={async () =>
              await p2party.deletePeerFromAddressBook(
                undefined,
                findSenderPeer()?.peerId ?? message.fromPeerId,
              )
            }
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

export default memo(MessageSenderDropdown);
