import { useState, lazy, Suspense } from "react";
import { QrCodeIcon } from "@heroicons/react/20/solid";

import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from "../navbar";
import Spinner from "../custom/spinner";

import QRCodeAlert from "../alerts/QRCodeAlert";

const SignalingDropdown = lazy(() => import("./SignalingDropdown"));
const PeerDropdown = lazy(() => import("./PeerDropdown"));
// const MessagesDropdown = lazy(() => import("./MessagesDropdown"));
const DeleteDropdown = lazy(() => import("./DeleteDropdown"));

export interface NavBarProps {
  roomUrl: string;
}

const NavBar = ({ roomUrl }: NavBarProps) => {
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
        <Suspense fallback={<Spinner />}>
          <SignalingDropdown />
        </Suspense>

        <Suspense fallback={<Spinner />}>
          <PeerDropdown />
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
