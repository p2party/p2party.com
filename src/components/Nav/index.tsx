import { useState, lazy, Suspense } from "react";
import {
  ChartBarSquareIcon,
  Cog8ToothIcon,
  PlusIcon,
} from "@heroicons/react/20/solid";

import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from "../navbar";

import Spinner from "../custom/spinner";
import CoverStatusPill from "../custom/CoverStatusPill";

import { useRoom } from "../../hooks/useRoom";
import { absoluteRoomInviteUrl } from "../../protocol/roomAccess";

const SettingsAlert = lazy(() => import("../alerts/SettingsAlert"));
const QRCodeAlert = lazy(() => import("../alerts/QRCodeAlert"));
const AddressBookAlert = lazy(() => import("../alerts/AddressBookAlert"));
const BlacklistAlert = lazy(() => import("../alerts/BlacklistAlert"));
const DiagnosticsAlert = lazy(() => import("../alerts/DiagnosticsAlert"));
const IdentityBackupAlert = lazy(() => import("../alerts/IdentityBackupAlert"));
const RestoreIdentityAlert = lazy(
  () => import("../alerts/RestoreIdentityAlert"),
);

// const SignalingDropdown = lazy(() => import("./SignalingDropdown"));
const PeerDropdown = lazy(() => import("./PeerDropdown"));
// const MessagesDropdown = lazy(() => import("./MessagesDropdown"));
const Share = lazy(() => import("./ShareDropdown"));
const IdentityDropdown = lazy(() => import("./IdentityDropdown"));
const DeleteDropdown = lazy(() => import("./DeleteDropdown"));
const RoomSetupAlert = lazy(() => import("../RoomSetupAlert"));

export interface NavBarProps {
  roomUrl: string;
}

const NavBar = ({ roomUrl }: NavBarProps) => {
  const { roomPolicy, identityBackupIsAvailable } = useRoom({
    subscribeToMessages: false,
  });
  const inviteUrl =
    roomUrl.length > 0 ? absoluteRoomInviteUrl(roomUrl, roomPolicy) : "";
  // A vendored build from before the identity backup API would show a menu
  // whose every item throws, so ask the build first.
  const canBackUpIdentity = identityBackupIsAvailable();

  const [showSettings, setShowSettings] = useState(false);
  const [showAddressBook, setShowAddressBook] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showRoomSetup, setShowRoomSetup] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showIdentityBackup, setShowIdentityBackup] = useState(false);
  const [showIdentityRestore, setShowIdentityRestore] = useState(false);

  return (
    <Navbar className='min-w-0 overflow-x-auto'>
      {/* <NavbarItem>
        <CatAvatar src='/logo-cat-tight.svg' />
        <NavbarLabel>p2party</NavbarLabel>
      </NavbarItem> */}
      <NavbarSpacer />

      {/* <ConnectButtonNavigation roomUrl={roomUrl ?? ""} /> */}

      <NavbarSection className='[--navbar-section-gap:0.25rem]'>
        {roomUrl.length === 0 && (
          <NavbarItem
            aria-label='new room'
            onClick={() => setShowRoomSetup(true)}
          >
            <PlusIcon />
          </NavbarItem>
        )}

        {roomUrl.length > 0 && (
          <>
            <CoverStatusPill />
            <Suspense fallback={<Spinner />}>
              <PeerDropdown
                setAddressBookIsOpen={setShowAddressBook}
                setBlacklistIsOpen={setShowBlacklist}
              />
              <AddressBookAlert
                isOpen={showAddressBook}
                setIsOpen={setShowAddressBook}
              />
              <BlacklistAlert
                isOpen={showBlacklist}
                setIsOpen={setShowBlacklist}
              />
            </Suspense>

            {/* <Suspense fallback={<Spinner />}>
          <MessagesDropdown />
        </Suspense> */}

            <Suspense fallback={<Spinner />}>
              <Share inviteUrl={inviteUrl} setShowQRCode={setShowQRCode} />
              <QRCodeAlert
                inviteUrl={inviteUrl}
                roomPolicy={roomPolicy}
                isOpen={showQRCode}
                setIsOpen={setShowQRCode}
              />
            </Suspense>
          </>
        )}

        {roomUrl.length > 0 && (
          <NavbarItem
            aria-label='advanced diagnostics'
            title='Advanced diagnostics'
            onClick={() => setShowDiagnostics(true)}
          >
            <ChartBarSquareIcon />
            <Suspense fallback={<Spinner />}>
              <DiagnosticsAlert
                isOpen={showDiagnostics}
                setIsOpen={setShowDiagnostics}
              />
            </Suspense>
          </NavbarItem>
        )}

        <NavbarItem aria-label='settings' onClick={() => setShowSettings(true)}>
          <Cog8ToothIcon />
          <Suspense fallback={<Spinner />}>
            <SettingsAlert isOpen={showSettings} setIsOpen={setShowSettings} />
          </Suspense>
        </NavbarItem>

        {/* The same menu the sidebar carries, worded the same. This bar is the
            phone's chrome and losing a phone is the reason a recovery phrase
            exists, so it is reachable here without opening the drawer first.
            It sits beside the delete menu rather than inside it: that one is
            destruction, and the item that hands a lost identity back does not
            belong one tap away from the item that destroys it.

            The dialogs are mounted out here, in a boundary of their own: a
            Headless UI menu unmounts its panel as it closes and would take an
            open dialog with it, and sharing the menu's boundary would swap the
            button for a spinner while their chunks load. */}
        {canBackUpIdentity && (
          <>
            <Suspense fallback={<Spinner />}>
              <IdentityDropdown
                setShowIdentityBackup={setShowIdentityBackup}
                setShowIdentityRestore={setShowIdentityRestore}
              />
            </Suspense>
            <Suspense>
              <IdentityBackupAlert
                // Remounting on every open and close is what drops the
                // recovery phrase from memory even when something other than
                // the dialog's own buttons closes it.
                key={String(showIdentityBackup)}
                isOpen={showIdentityBackup}
                setIsOpen={setShowIdentityBackup}
              />
              <RestoreIdentityAlert
                // Same reason as above: the phrase typed in here must not
                // outlive the panel, whoever closed it.
                key={String(showIdentityRestore)}
                isOpen={showIdentityRestore}
                setIsOpen={setShowIdentityRestore}
              />
            </Suspense>
          </>
        )}

        <Suspense fallback={<Spinner />}>
          <DeleteDropdown />
        </Suspense>
        <Suspense>
          <RoomSetupAlert isOpen={showRoomSetup} setIsOpen={setShowRoomSetup} />
        </Suspense>
      </NavbarSection>
    </Navbar>
  );
};

export default NavBar;
