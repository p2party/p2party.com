import {
  authenticatedSenderRoute,
  isLocalMessage,
} from "../../protocol/messageIdentity";
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
  const keyPair = useSelector(p2party.keyPairSelector);
  const peerId = keyPair.peerId;
  const publicKey = message.fromPeerPublicKey;
  const canManage = !!publicKey && publicKey !== keyPair.publicKey;
  const [entry, setEntry] = useState<{
    publicKey: string;
    name?: string;
    blocked: boolean;
  }>();
  const [verifyPeerId, setVerifyPeerId] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!canManage || !publicKey) return;
    let current = true;
    Promise.all([
      p2party.getPeerAddressBookEntry(publicKey),
      p2party.getPeerIsBlacklisted(publicKey),
    ])
      .then(([contact, blocked]) => {
        if (current) setEntry({ publicKey, name: contact?.username, blocked });
      })
      .catch((error: unknown) =>
        console.error("p2party: could not read contact", error),
      );
    return () => {
      current = false;
    };
  }, [publicKey, canManage]);

  const contact = entry?.publicKey === publicKey ? entry : undefined;
  const displayName =
    contact?.name ?? `unknown peer ${message.fromPeerId.slice(0, 8)}`;
  const own = isLocalMessage(message, keyPair.publicKey);

  // An authenticated sender can be saved or blocked from history. The safety
  // number includes a routing id, so use the current authenticated session
  // when comparing numbers with another device.
  const handleVerify = () => {
    const rooms = p2party.roomSelector(p2party.store.getState());
    const route = publicKey && authenticatedSenderRoute(rooms, publicKey);
    if (route) {
      setVerifyPeerId(route);
      setActionError("");
      setVerifyOpen(true);
      return;
    }
    setActionError("Connect to this identity to compare safety numbers.");
  };

  const updateContact = async (action: "save" | "remove" | "block") => {
    if (!publicKey || !contact) return;
    try {
      setActionError("");
      if (action === "save") {
        const suggested = `peer ${publicKey.slice(0, 8)}`;
        const name = window.prompt("Save this contact as:", suggested);
        if (name === null) return;
        const username = name.trim() || suggested;
        await p2party.addPeerToAddressBook(
          username,
          message.fromPeerId,
          publicKey,
        );
        setEntry({ ...contact, name: username });
      } else if (action === "remove") {
        await p2party.deletePeerFromAddressBook(publicKey);
        setEntry({ ...contact, name: undefined });
      } else {
        await p2party.blacklistPeer(message.fromPeerId, publicKey);
        setEntry({ ...contact, blocked: true });
      }
    } catch {
      setActionError("Could not update this contact.");
    }
  };

  return (
    <>
      {canManage && publicKey && verifyOpen && (
        <VerifyIdentityAlert
          isOpen={verifyOpen}
          setIsOpen={setVerifyOpen}
          localPublicKey={keyPair.publicKey}
          localPeerId={peerId}
          peerPublicKey={publicKey}
          peerId={verifyPeerId}
          peerLabel={displayName}
          storedPublicKey={contact?.name ? contact.publicKey : undefined}
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
          anchor={own ? "bottom end" : "bottom start"}
        >
          <DropdownHeader>
            <div className='pr-6'>
              <div className='text-xs text-zinc-500 dark:text-zinc-400'>
                {!publicKey
                  ? "No sender key in this message"
                  : contact?.name
                    ? "Saved contact"
                    : own
                      ? "Your identity"
                      : "Peer identity"}
              </div>
              <div className='text-sm/7 font-semibold text-zinc-800 dark:text-white'>
                {displayName}
              </div>
              <div className='font-mono text-[10px] text-zinc-500 dark:text-zinc-400'>
                {message.fromPeerId.slice(0, 8)}
              </div>
              {actionError && (
                <p role='alert' className='mt-2 text-xs'>
                  {actionError}
                </p>
              )}
            </div>
          </DropdownHeader>
          <DropdownDivider />

          {canManage && contact && !contact.name && (
            <DropdownItem onClick={() => updateContact("save")}>
              <UserPlusIcon />
              Add Contact
            </DropdownItem>
          )}
          {canManage && (
            <DropdownItem onClick={handleVerify}>
              <ShieldCheckIcon />
              <DropdownLabel>Verify identity</DropdownLabel>
            </DropdownItem>
          )}
          {canManage && contact?.name && (
            <DropdownItem onClick={() => updateContact("remove")}>
              <UserMinusIcon />
              Delete Contact
            </DropdownItem>
          )}
          {canManage && contact && !contact.blocked && (
            <DropdownItem onClick={() => updateContact("block")}>
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
