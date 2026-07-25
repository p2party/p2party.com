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

// const SignalingDropdown = lazy(() => import("./SignalingDropdown"));
const PeerDropdown = lazy(() => import("./PeerDropdown"));
// const MessagesDropdown = lazy(() => import("./MessagesDropdown"));
const Share = lazy(() => import("./ShareDropdown"));
const DeleteDropdown = lazy(() => import("./DeleteDropdown"));
const RoomSetupAlert = lazy(() => import("../RoomSetupAlert"));

export interface NavBarProps {
  roomUrl: string;
}

const NavBar = ({ roomUrl }: NavBarProps) => {
  const { roomPolicy } = useRoom({
    subscribeToMessages: false,
  });
  const inviteUrl =
    roomUrl.length > 0 ? absoluteRoomInviteUrl(roomUrl, roomPolicy) : "";

  const [showSettings, setShowSettings] = useState(false);
  const [showAddressBook, setShowAddressBook] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showRoomSetup, setShowRoomSetup] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  return (
    <Navbar>
      {/* <NavbarItem>
        <CatAvatar />
        <NavbarLabel>p2party</NavbarLabel>
      </NavbarItem> */}
      <NavbarSpacer />

      {/* <ConnectButtonNavigation roomUrl={roomUrl ?? ""} /> */}

      <NavbarSection className='gap-1'>
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
                roomUrl={roomUrl}
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
