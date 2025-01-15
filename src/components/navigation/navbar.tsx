import { useState, lazy, Suspense } from "react";
import { QrCodeIcon } from "@heroicons/react/20/solid";

import {
  Navbar,
  NavbarItem,
  NavbarSection,
  //  NavbarItem, NavbarLabel,
  NavbarSpacer,
} from "../navbar";
// import ConnectButtonNavigation from "../buttons/connectNavigation";
import Spinner from "../custom/spinner";

import QRCodeAlert from "../alerts/QRCodeAlert";

// const SignalingDropdownNavigation = lazy(
//   () => import("../dropdowns/signalingDropdownNavigation"),
// );
const PeerDropdownNavigation = lazy(
  () => import("../dropdowns/peerDropdownNavigation"),
);
const MessagesDropdownNavigation = lazy(
  () => import("../dropdowns/messagesDropdownNavigation"),
);
const DeleteDropdownNavigation = lazy(
  () => import("../dropdowns/deleteDropdownNavigation"),
)

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

      <NavbarSection className="gap-1">
        {/* {messages.length > 0 && (
          <Suspense fallback={<Spinner />}>
            <SignalingDropdownNavigation />
          </Suspense>
        )} */}

        <Suspense fallback={<Spinner />}>
          <PeerDropdownNavigation />
        </Suspense>

        <Suspense fallback={<Spinner />}>
          <MessagesDropdownNavigation />
        </Suspense>

        <NavbarItem aria-label='qr' onClick={() => setShowQRCode(true)}>
          <QrCodeIcon />
          <QRCodeAlert
            roomUrl={roomUrl}
            isOpen={showQRCode}
            setIsOpen={setShowQRCode}
          />
        </NavbarItem>

        <Suspense fallback={<Spinner />}>
          <DeleteDropdownNavigation />
        </Suspense>
      </NavbarSection>
    </Navbar>
  );
};

export default NavBar;
