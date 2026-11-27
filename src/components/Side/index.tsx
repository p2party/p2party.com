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
import { RoomWalletNav } from "../SharedWalletBalance";

import SettingsAlert from "../alerts/SettingsAlert";
import IdentityBackupAlert from "../alerts/IdentityBackupAlert";
import RestoreIdentityAlert from "../alerts/RestoreIdentityAlert";
import AddressBookAlert from "../alerts/AddressBookAlert";
import BlacklistAlert from "../alerts/BlacklistAlert";
import QRCodeAlert from "../alerts/QRCodeAlert";

import { useRoom } from "../../hooks/useRoom";
import { absoluteRoomInviteUrl } from "../../protocol/roomAccess";
import p2party from "../../protocol/sdk";

const SignalingDropdown = lazy(() => import("./SignalingDropdown"));
const PeerDropdown = lazy(() => import("./PeerDropdown"));
const IdentityDropdown = lazy(() => import("./IdentityDropdown"));
const DeleteDropdown = lazy(() => import("./DeleteDropdown"));

export interface SideBarProps {
  roomUrl: string;
}

const SideBar = () => {
  const { roomUrl, roomPolicy, identityBackupIsAvailable } = useRoom({
    subscribeToMessages: false,
  });
  const inviteUrl = roomUrl ? absoluteRoomInviteUrl(roomUrl, roomPolicy) : "";
  // A vendored build from before the identity backup API would show an entry
  // whose every button throws, so ask the build first.
  const canBackUpIdentity = identityBackupIsAvailable();

  const [showSettings, setShowSettings] = useState(false);
  const [showIdentityBackup, setShowIdentityBackup] = useState(false);
  const [showIdentityRestore, setShowIdentityRestore] = useState(false);
  const [showAddressBook, setShowAddressBook] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href={"/"}>
          {/* No mark here. SidebarItem lays its children out on a subgrid
              whose first column is sized for an icon slot, and the avatar is
              not one, so it sat in the row without ever lining up with the
              wordmark beside it. The cat is already on the page behind the
              conversation -- printing it twice, badly, to say the same thing
              is not worth the row. */}
          <SidebarItem className='lg:mb-2.5'>
            <SidebarLabel>
              <span className='font-mono font-bold'>
                p2party
                <span className='text-orange-400'>://</span>
                room
              </span>
            </SidebarLabel>
          </SidebarItem>
        </Link>
        <RoomWalletNav />
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

        {/* Backing an identity up and restoring one are a menu of their own,
            sitting beside the delete menu rather than inside it: that menu is
            destruction — purge the identity, the room, everything — and the
            item that hands a lost identity back does not belong one tap away
            from the item that destroys it.

            Both dialogs are mounted out here rather than in the menu. A
            Headless UI menu unmounts its panel as it closes, which would take
            an open dialog with it, and a portal's clicks still bubble through
            the React tree, so a click on the dialog's Done button would land
            on the row that opened it and reopen what it had just closed. */}
        {canBackUpIdentity && (
          <>
            <Suspense>
              <IdentityDropdown
                setShowIdentityBackup={setShowIdentityBackup}
                setShowIdentityRestore={setShowIdentityRestore}
              />
            </Suspense>
            <IdentityBackupAlert
              // Remounting on every open and close is what drops the recovery
              // phrase from memory even when something other than the dialog's
              // own buttons closes it.
              key={`backup-${String(showIdentityBackup)}`}
              isOpen={showIdentityBackup}
              setIsOpen={setShowIdentityBackup}
            />
            <RestoreIdentityAlert
              // Same reason as above: the phrase typed in here must not
              // outlive the panel, whoever closed it.
              key={`restore-${String(showIdentityRestore)}`}
              isOpen={showIdentityRestore}
              setIsOpen={setShowIdentityRestore}
            />
          </>
        )}

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
