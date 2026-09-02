import { lazy, Suspense, useState } from "react";

import {
  ArchiveBoxXMarkIcon,
  ArrowUturnLeftIcon,
  BookOpenIcon,
  Cog8ToothIcon,
  KeyIcon,
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

        {/* The sidebar is the whole app's reach: on a phone it is what the
            hamburger opens, so one entry here covers both layouts and the
            navbar keeps the room it has. The dialog sits outside the item
            because a portal's clicks still bubble through the React tree, and
            a click on its Done button would land on this row's onClick and
            reopen what it had just closed. */}
        {canBackUpIdentity && (
          <>
            <SidebarItem onClick={() => setShowIdentityBackup(true)}>
              <span className='flex min-w-0 items-center gap-3'>
                <KeyIcon className='size-9 lg:size-7' />
                <span className='min-w-0'>
                  <span className='block truncate text-sm/5 font-medium text-zinc-100'>
                    Back up identity
                  </span>
                </span>
              </span>
            </SidebarItem>
            <IdentityBackupAlert
              // Remounting on every open and close is what drops the recovery
              // phrase from memory even when something other than the dialog's
              // own buttons closes it.
              key={String(showIdentityBackup)}
              isOpen={showIdentityBackup}
              setIsOpen={setShowIdentityBackup}
            />

            {/* Restoring is its own row rather than a panel of the backup
                dialog: it is reached from a device that has lost an identity,
                not from one reading the identity it has, and the two share
                nothing but the wordlist. */}
            <SidebarItem onClick={() => setShowIdentityRestore(true)}>
              <span className='flex min-w-0 items-center gap-3'>
                <ArrowUturnLeftIcon className='size-9 lg:size-7' />
                <span className='min-w-0'>
                  <span className='block truncate text-sm/5 font-medium text-zinc-100'>
                    Restore identity
                  </span>
                </span>
              </span>
            </SidebarItem>
            <RestoreIdentityAlert
              // Same reason as above: the phrase typed in here must not
              // outlive the panel, whoever closed it.
              key={String(showIdentityRestore)}
              isOpen={showIdentityRestore}
              setIsOpen={setShowIdentityRestore}
            />
          </>
        )}

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
