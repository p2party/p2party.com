import { useState, useEffect, memo } from "react";
import { useSelector } from "react-redux";
import p2party from "../../protocol/sdk";

import { Avatar } from "../avatar";
import {
  Dropdown,
  DropdownButton,
  DropdownLabel,
  DropdownMenu,
  DropdownItem,
  DropdownHeader,
  DropdownDivider,
} from "../dropdown";
import {
  ShieldCheckIcon,
  UserMinusIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";

import VerifyIdentityAlert from "../alerts/VerifyIdentityAlert";

import type { Message } from "p2party";

export interface MessageSenderDropdownProps {
  message: Message;
}

const MessageSenderDropdown = ({ message }: MessageSenderDropdownProps) => {
  // Narrow subscription: peerId only. The address-book / blacklist functions are
  // stable module fns, and the peer's public key is looked up from the store at
  // click time — so this row never re-renders on peer/message churn.
  const keyPair = useSelector(p2party.keyPairSelector);
  const peerId = keyPair.peerId;

  const [userInAddressBook, setUserInAddressBook] = useState(false);
  const [userInBlacklist, setUserInBlacklist] = useState(false);
  // The saved contact's name, and the identity key recorded when they were
  // saved. Keeping the key is what makes a later key change detectable.
  const [savedUsername, setSavedUsername] = useState("");
  const [savedPublicKey, setSavedPublicKey] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [livePublicKey, setLivePublicKey] = useState("");

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
          // The entry is a UsernamedPeer, not a boolean. Keeping the name and
          // the key it was saved with is the whole point of an address book.
          setSavedUsername(peerInAddressBook.username);
          setSavedPublicKey(peerInAddressBook.peerPublicKey);
        } else {
          const peerInBlacklist = await p2party.getPeerIsBlacklisted(
            message.fromPeerId,
          );
          if (!cancelled && peerInBlacklist) setUserInBlacklist(true);
        }
        // Inlined rather than calling findSenderPeer, so the effect's only
        // dependency stays the sender identity.
        if (!cancelled) {
          const rooms = p2party.roomSelector(p2party.store.getState());
          const live = rooms
            .flatMap((room) => room.peers)
            .find((p) => p.peerId === message.fromPeerId);
          setLivePublicKey(live?.peerPublicKey ?? "");
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

  // A contact whose name is literally "No username found" is not a contact.
  // Ask for the name, since the whole value of saving a peer is being able to
  // recognise them next time.
  const handleAddPeerToAddressBook = async () => {
    const peer = findSenderPeer();
    if (!peer) return;
    const suggested = `peer ${peer.peerId.slice(0, 8)}`;
    const name = window.prompt("Save this contact as:", suggested);
    if (name === null) return;
    const username = name.trim().length > 0 ? name.trim() : suggested;
    try {
      await p2party.addPeerToAddressBook(
        username,
        peer.peerId,
        peer.peerPublicKey,
      );
      setUserInAddressBook(true);
      setSavedUsername(username);
      setSavedPublicKey(peer.peerPublicKey);
    } catch (error) {
      console.error("p2party: could not save contact", error);
    }
  };

  // Derived, not stored: a saved name if we have one, otherwise an explicit
  // "unknown" so a stranger is never visually identical to a known contact.
  const displayName = userInAddressBook
    ? savedUsername
    : `unknown peer ${message.fromPeerId.slice(0, 8)}`;

  // The signal that separates a routine key rotation from an impersonation.
  const identityKeyChanged =
    userInAddressBook &&
    savedPublicKey.length > 0 &&
    livePublicKey.length > 0 &&
    savedPublicKey.toLowerCase() !== livePublicKey.toLowerCase();

  const canVerify =
    message.fromPeerId !== peerId &&
    livePublicKey.length > 0 &&
    keyPair.publicKey.length > 0;

  const handleBlacklisting = async () => {
    const peer = findSenderPeer();
    if (peer) await p2party.blacklistPeer(peer.peerId, peer.peerPublicKey);
    else await p2party.blacklistPeer(message.fromPeerId, "");
  };

  return (
    <>
      {canVerify && (
        <VerifyIdentityAlert
          isOpen={verifyOpen}
          setIsOpen={setVerifyOpen}
          localPublicKey={keyPair.publicKey}
          localPeerId={peerId}
          peerPublicKey={livePublicKey}
          peerId={message.fromPeerId}
          peerLabel={displayName}
          storedPublicKey={userInAddressBook ? savedPublicKey : undefined}
        />
      )}
      <Dropdown>
        {/* The button's default padding put ~11px of dead space around a 28px
            avatar on every message, which is most of the gutter the thread was
            spending on it. The avatar is the hit target. */}
        <DropdownButton plain className='p-0!'>
          <Avatar
            initials={message.fromPeerId.slice(
              message.fromPeerId.length - 2,
              message.fromPeerId.length,
            )}
            className='w-7 shrink-0 rounded-full sm:w-9'
          />
        </DropdownButton>

        <DropdownMenu
          className='min-w-64'
          anchor={message.fromPeerId !== peerId ? "bottom start" : "bottom end"}
        >
          <DropdownHeader>
            <div className='pr-6'>
              <div className='text-xs text-zinc-500 dark:text-zinc-400'>
                {userInAddressBook ? "Saved contact" : "Not in your contacts"}
              </div>
              <div className='text-sm/7 font-semibold text-zinc-800 dark:text-white'>
                {displayName}
              </div>
              <div className='font-mono text-[10px] text-zinc-500 dark:text-zinc-400'>
                {message.fromPeerId.slice(0, 8)}
              </div>
              {identityKeyChanged && (
                <p
                  role='alert'
                  className='mt-2 border-2 border-red-500 bg-red-50 p-2 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-200'
                >
                  Identity key changed since you saved this contact. Verify
                  before trusting.
                </p>
              )}
            </div>
          </DropdownHeader>
          <DropdownDivider />

          {!userInAddressBook && message.fromPeerId !== peerId && (
            <DropdownItem onClick={handleAddPeerToAddressBook}>
              <UserPlusIcon />
              Add Contact
            </DropdownItem>
          )}

          {canVerify && (
            <DropdownItem
              onClick={() => {
                setVerifyOpen(true);
              }}
            >
              <ShieldCheckIcon />
              <DropdownLabel>Verify identity</DropdownLabel>
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
    </>
  );
};

export default memo(MessageSenderDropdown);
