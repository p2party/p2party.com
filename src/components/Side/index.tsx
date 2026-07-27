import { lazy, Suspense, useState } from "react";

import {
  ArchiveBoxXMarkIcon,
  BookOpenIcon,
  Cog8ToothIcon,
  QrCodeIcon,
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
import p2party from "../../protocol/sdk";

const CatAvatar = lazy(() => import("../avatars/cat"));
const SignalingDropdown = lazy(() => import("./SignalingDropdown"));
const PeerDropdown = lazy(() => import("./PeerDropdown"));
const DeleteDropdown = lazy(() => import("./DeleteDropdown"));

export interface SideBarProps {
  roomUrl: string;
}

const SideBar = () => {
  const { roomUrl, roomPolicy } = useRoom({
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
              <CatAvatar src='/logo-cat-tight.svg' />
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

        {/* The room id and peer id used to sit here as two unlabelled icons
            with a dash, which told the user nothing. Both are shown, labelled,
            in the diagnostics panel. */}

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
