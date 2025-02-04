import { lazy, Suspense, useState } from "react";
import { useParams } from "react-router";

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

const CatAvatar = lazy(() => import("../avatars/cat"));
const SignalingDropdown = lazy(() => import("./SignalingDropdown"));
const PeerDropdown = lazy(() => import("./PeerDropdown"));
const DeleteDropdown = lazy(() => import("./DeleteDropdown"));

export interface SideBarProps {
  roomUrl: string;
}

const SideBar = () => {
  const { roomId, peerId } = useRoom();
  const { roomUrl } = useParams();

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
            <SidebarLabel>p2party</SidebarLabel>
          </SidebarItem>
        </Link>
      </SidebarHeader>

      <SidebarBody>
        <Suspense>
          <PeerDropdown />
        </Suspense>

        <SidebarItem>
          <span className='flex min-w-0 items-center gap-3'>
            <HomeIcon className='size-10' />
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                Room ID:
              </span>
              <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                {roomId.length > 0 ? roomId : '""'}
              </span>
            </span>
          </span>
        </SidebarItem>

        <SidebarItem>
          <span className='flex min-w-0 items-center gap-3'>
            <UserIcon className='size-10' />
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                My Peer ID:
              </span>
              <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
                {peerId.length > 0 ? peerId : '""'}
              </span>
            </span>
          </span>
        </SidebarItem>

        <SidebarItem onClick={() => setShowSettings(true)}>
          <span className='flex min-w-0 items-center gap-3'>
            <Cog8ToothIcon className='size-9 lg:size-7' />
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
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
              <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                Address Book
              </span>
            </span>
          </span>
          <AddressBookAlert
            isOpen={showAddressBook}
            setIsOpen={setShowAddressBook}
          />
        </SidebarItem>

        <SidebarItem onClick={() => setShowQRCode(true)}>
          <span className='flex min-w-0 items-center gap-3'>
            <QrCodeIcon className='size-9 lg:size-7' />
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
                Show room QR code
              </span>
            </span>
          </span>
          <QRCodeAlert
            roomUrl={roomUrl ?? ""}
            isOpen={showQRCode}
            setIsOpen={setShowQRCode}
          />
        </SidebarItem>

        <SidebarItem onClick={() => setShowBlacklist(true)}>
          <span className='flex min-w-0 items-center gap-3'>
            <ArchiveBoxXMarkIcon className='size-9 lg:size-7' />
            <span className='min-w-0'>
              <span className='block truncate text-sm/5 font-medium text-zinc-950 dark:text-white'>
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
      </SidebarBody>
    </Sidebar>
  );
};

export default SideBar;
