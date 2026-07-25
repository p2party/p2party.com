import { lazy, Suspense, useEffect, useState } from "react";

import type { ReactNode } from "react";

import {
  ArchiveBoxXMarkIcon,
  BookOpenIcon,
  Cog8ToothIcon,
  HomeIcon,
  QrCodeIcon,
  UserIcon,
} from "@heroicons/react/20/solid";

import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from "../sidebar";
import { Link } from "../link";

import SettingsAlert from "../alerts/SettingsAlert";
import AddressBookAlert from "../alerts/AddressBookAlert";
import BlacklistAlert from "../alerts/BlacklistAlert";
import QRCodeAlert from "../alerts/QRCodeAlert";

import { useRoom } from "../../hooks/useRoom";
import { absoluteRoomInviteUrl } from "../../protocol/roomAccess";
import p2party from "p2party";

const CatAvatar = lazy(() => import("../avatars/cat"));
const SignalingDropdown = lazy(() => import("./SignalingDropdown"));
const PeerDropdown = lazy(() => import("./PeerDropdown"));
const DeleteDropdown = lazy(() => import("./DeleteDropdown"));

export interface SideBarProps {
  roomUrl: string;
}

/**
 * A labelled identifier on the console panel. The value is the point, so it
 * gets the room to breathe (two lines of mono) and a copy control — a
 * truncated id you cannot select is decoration, not information.
 */
const IdentityField = ({ value, icon }: { value: string; icon: ReactNode }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(false);
    }, 1600);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  const present = value.length > 0;

  return (
    <div className='px-2 py-1.5'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-orange-400'>{icon}</span>
        {present && (
          <button
            type='button'
            onClick={() => {
              void navigator.clipboard
                .writeText(value)
                .then(() => {
                  setCopied(true);
                })
                .catch(() => {
                  setCopied(false);
                });
            }}
            className='font-mono text-[10px] tracking-[0.1em] text-zinc-400 uppercase transition-colors hover:text-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500'
          >
            {copied ? "copied" : "copy"}
          </button>
        )}
      </div>
      <p className='mt-1 font-mono text-[11px] leading-snug wrap-anywhere text-zinc-300 select-text'>
        {present ? value : "—"}
      </p>
    </div>
  );
};

const SideBar = () => {
  const { roomUrl, roomId, peerId, roomPolicy } = useRoom({
    subscribeToMessages: false,
  });
  const inviteUrl = roomUrl ? absoluteRoomInviteUrl(roomUrl, roomPolicy) : "";

  const [showSettings, setShowSettings] = useState(false);
  const [showAddressBook, setShowAddressBook] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href={"/"}>
          <SidebarItem className='lg:mb-2.5'>
            <Suspense>
              <CatAvatar />
            </Suspense>
            <SidebarLabel>
              <span className='font-mono font-bold'>
                p2party
                <span className='text-orange-400'>://</span>
                room
              </span>
            </SidebarLabel>
          </SidebarItem>
        </Link>
      </SidebarHeader>

      <SidebarBody>
        {roomUrl && (
          <Suspense>
            <PeerDropdown />
          </Suspense>
        )}

        {roomUrl && (
          <IdentityField
            value={roomId}
            icon={<HomeIcon className='size-4' />}
          />
        )}

        <IdentityField value={peerId} icon={<UserIcon className='size-4' />} />

        <SidebarItem onClick={() => setShowSettings(true)}>
          <span className='flex min-w-0 items-center gap-3'>
            <Cog8ToothIcon className='size-9 lg:size-7' />
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-100'>
                Settings
              </span>
            </span>
          </span>
          <SettingsAlert isOpen={showSettings} setIsOpen={setShowSettings} />
        </SidebarItem>

        <SidebarItem onClick={() => setShowAddressBook(true)}>
          <span className='flex min-w-0 items-center gap-3'>
            <BookOpenIcon className='size-9 lg:size-7' />
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-100'>
                Address Book
              </span>
            </span>
          </span>
          <AddressBookAlert
            isOpen={showAddressBook}
            setIsOpen={setShowAddressBook}
          />
        </SidebarItem>

        {roomUrl && (
          <SidebarItem onClick={() => setShowQRCode(true)}>
            <span className='flex min-w-0 items-center gap-3'>
              <QrCodeIcon className='size-9 lg:size-7' />
              <span className='min-w-0'>
                <span className='block truncate text-sm/5 font-medium text-zinc-100'>
                  Show room QR code
                </span>
              </span>
            </span>
            <QRCodeAlert
              roomUrl={roomUrl ?? ""}
              inviteUrl={inviteUrl}
              roomPolicy={roomPolicy}
              isOpen={showQRCode}
              setIsOpen={setShowQRCode}
            />
          </SidebarItem>
        )}

        <SidebarItem onClick={() => setShowBlacklist(true)}>
          <span className='flex min-w-0 items-center gap-3'>
            <ArchiveBoxXMarkIcon className='size-9 lg:size-7' />
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-100'>
                Blacklist
              </span>
            </span>
          </span>
          <BlacklistAlert isOpen={showBlacklist} setIsOpen={setShowBlacklist} />
        </SidebarItem>

        <Suspense>
          <DeleteDropdown />
        </Suspense>

        <SidebarSpacer />

        <SidebarSection>
          <SidebarHeading>Servers</SidebarHeading>

          <SignalingDropdown />
        </SidebarSection>

        <SidebarSection>
          <SidebarHeading>Using p2party-js v{p2party.VERSION}</SidebarHeading>
        </SidebarSection>
      </SidebarBody>
    </Sidebar>
  );
};

export default SideBar;
