import { useState, lazy, Suspense } from "react";
import { Cog8ToothIcon, PlusIcon } from "@heroicons/react/20/solid";

import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from "../navbar";

import Spinner from "../custom/spinner";

import { useRoom } from "../../hooks/useRoom";

const SettingsAlert = lazy(() => import("../alerts/SettingsAlert"));
const QRCodeAlert = lazy(() => import("../alerts/QRCodeAlert"));
const AddressBookAlert = lazy(() => import("../alerts/AddressBookAlert"));
const BlacklistAlert = lazy(() => import("../alerts/BlacklistAlert"));

// const SignalingDropdown = lazy(() => import("./SignalingDropdown"));
const PeerDropdown = lazy(() => import("./PeerDropdown"));
// const MessagesDropdown = lazy(() => import("./MessagesDropdown"));
const Share = lazy(() => import("./ShareDropdown"));
const DeleteDropdown = lazy(() => import("./DeleteDropdown"));

export interface NavBarProps {
  roomUrl: string;
}

const NavBar = ({ roomUrl }: NavBarProps) => {
  const { goToRandomRoom } = useRoom();

  const [showSettings, setShowSettings] = useState(false);
  const [showAddressBook, setShowAddressBook] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  return (
    <Navbar>
      {/* <NavbarItem>
        <CatAvatar />
        <NavbarLabel>p2party</NavbarLabel>
      </NavbarItem> */}
      <NavbarSpacer />

      {/* <ConnectButtonNavigation roomUrl={roomUrl ?? ""} /> */}

      <NavbarSection className='gap-1'>
        {roomUrl.length !== 64 && (
          <NavbarItem aria-label='new room' onClick={() => goToRandomRoom()}>
            <PlusIcon />
          </NavbarItem>
        )}

        <NavbarItem aria-label='settings' onClick={() => setShowSettings(true)}>
          <Cog8ToothIcon />
          <Suspense fallback={<Spinner />}>
            <SettingsAlert isOpen={showSettings} setIsOpen={setShowSettings} />
          </Suspense>
        </NavbarItem>

        {roomUrl.length === 64 && (
          <>
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
              <Share roomUrl={roomUrl} setShowQRCode={setShowQRCode} />
              <QRCodeAlert
                roomUrl={roomUrl}
                isOpen={showQRCode}
                setIsOpen={setShowQRCode}
              />
            </Suspense>
          </>
        )}

        <Suspense fallback={<Spinner />}>
          <DeleteDropdown />
        </Suspense>
      </NavbarSection>
    </Navbar>
  );
};

export default NavBar;
