import {
  ArrowUpOnSquareIcon,
  QrCodeIcon,
  ShareIcon,
} from "@heroicons/react/20/solid";

import { NavbarItem } from "../navbar";
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "../dropdown";

import type { FC, Dispatch, SetStateAction } from "react";

export interface ShareProps {
  roomUrl: string;
  setShowQRCode: Dispatch<SetStateAction<boolean>>;
}

const Share: FC<ShareProps> = ({ roomUrl, setShowQRCode }) => {
  const url = "https://p2party.com/rooms/" + roomUrl;
  const shareData: ShareData = {
    title: "P2Party room URL",
    // text: "Join me in this room",
    url,
  };

  const handleShare = async () => {
    try {
      await navigator.share(shareData);
    } catch (error) {
      console.error(error);
    }
  };

  // @ts-ignore
  if (navigator.share) {
    return (
      <Dropdown>
        <DropdownButton as={NavbarItem}>
          <ShareIcon />
        </DropdownButton>

        <DropdownMenu className='min-w-64' anchor='bottom start'>
          <DropdownItem onClick={handleShare}>
            <ArrowUpOnSquareIcon />
            Share
          </DropdownItem>

          <DropdownItem onClick={() => setShowQRCode(true)}>
            <QrCodeIcon />
            Show QR code
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    );
  } else {
    return (
      <NavbarItem aria-label='qr' onClick={() => setShowQRCode(true)}>
        <QrCodeIcon />
      </NavbarItem>
    );
  }
};

export default Share;
