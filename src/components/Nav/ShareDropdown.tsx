import {
  ArrowUpOnSquareIcon,
  KeyIcon,
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
  inviteUrl: string;
  setShowQRCode: Dispatch<SetStateAction<boolean>>;
  setShowWords: Dispatch<SetStateAction<boolean>>;
}

const Share: FC<ShareProps> = ({ inviteUrl, setShowQRCode, setShowWords }) => {
  const shareData: ShareData = {
    title: "P2Party room invitation",
    text: "Join this protocol-v4 room. If it uses a PIN, send the PIN separately.",
    url: inviteUrl,
  };

  const handleShare = async () => {
    try {
      await navigator.share(shareData);
    } catch (error) {
      console.error(error);
    }
  };

  // @ts-expect-error navigator.share may not be defined
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

          <DropdownItem onClick={() => setShowWords(true)}>
            <KeyIcon />
            Show 24 words
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    );
  } else {
    return (
      <Dropdown>
        <DropdownButton as={NavbarItem}>
          <ShareIcon />
        </DropdownButton>

        <DropdownMenu className='min-w-64' anchor='bottom start'>
          <DropdownItem onClick={() => setShowQRCode(true)}>
            <QrCodeIcon />
            Show QR code
          </DropdownItem>

          <DropdownItem onClick={() => setShowWords(true)}>
            <KeyIcon />
            Show 24 words
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    );
  }
};

export default Share;
