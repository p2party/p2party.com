import { useState, lazy, Suspense } from "react";
import { Cog8ToothIcon, QrCodeIcon } from "@heroicons/react/20/solid";

import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from "../navbar";
import Spinner from "../custom/spinner";

import QRCodeAlert from "../alerts/QRCodeAlert";
import SettingsAlert from "../alerts/SettingsAlert";
import AddressBookAlert from "../alerts/AddressBookAlert";
import BlacklistAlert from "../alerts/BlacklistAlert";

// const SignalingDropdown = lazy(() => import("./SignalingDropdown"));
const PeerDropdown = lazy(() => import("./PeerDropdown"));
// const MessagesDropdown = lazy(() => import("./MessagesDropdown"));
const DeleteDropdown = lazy(() => import("./DeleteDropdown"));

export interface NavBarProps {
  roomUrl: string;
}

const NavBar = ({ roomUrl }: NavBarProps) => {
  const [showQRCode, setShowQRCode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddressBook, setShowAddressBook] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(false);

  return (
    <Navbar>
      {/* <NavbarItem>
        <CatAvatar />
        <NavbarLabel>p2party</NavbarLabel>
      </NavbarItem> */}
      <NavbarSpacer />

      {/* <ConnectButtonNavigation roomUrl={roomUrl ?? ""} /> */}

      <NavbarSection className='gap-1'>
        <NavbarItem aria-label='settings' onClick={() => setShowSettings(true)}>
          <Cog8ToothIcon />
          <SettingsAlert isOpen={showSettings} setIsOpen={setShowSettings} />
        </NavbarItem>

        <Suspense fallback={<Spinner />}>
          <PeerDropdown
            setAddressBookIsOpen={setShowAddressBook}
            setBlacklistIsOpen={setShowBlacklist}
          />
          <AddressBookAlert
            isOpen={showAddressBook}
            setIsOpen={setShowAddressBook}
          />
          <BlacklistAlert isOpen={showBlacklist} setIsOpen={setShowBlacklist} />
        </Suspense>

        {/* <Suspense fallback={<Spinner />}>
          <MessagesDropdown />
        </Suspense> */}

        <NavbarItem aria-label='qr' onClick={() => setShowQRCode(true)}>
          <QrCodeIcon />
          <QRCodeAlert
            roomUrl={roomUrl}
            isOpen={showQRCode}
            setIsOpen={setShowQRCode}
          />
        </NavbarItem>

        <Suspense fallback={<Spinner />}>
          <DeleteDropdown />
        </Suspense>
      </NavbarSection>
    </Navbar>
  );
};

export default NavBar;
