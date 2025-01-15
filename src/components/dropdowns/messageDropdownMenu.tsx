import { DropdownMenu, DropdownItem } from "../dropdown";
import {
  ArrowTopRightOnSquareIcon,
  StopIcon,
  TrashIcon,
  NoSymbolIcon,
} from "@heroicons/react/16/solid";

// import type { Message, FileExtension, MimeType } from "p2party";

export interface MessageDropdownMenuProps {
  userIsReceiver: boolean;
  percentage: number;
}

const MessageDropdownMenu = ({
  userIsReceiver,
  percentage,
}: MessageDropdownMenuProps) => {
  return (
    <DropdownMenu
      className='min-w-64'
      anchor={userIsReceiver ? "bottom start" : "bottom end"}
    >
      {percentage === 100 && (
        <>
          <DropdownItem>
            <ArrowTopRightOnSquareIcon />
            Open in browser
          </DropdownItem>

          <DropdownItem>
            <ArrowTopRightOnSquareIcon />
            Download
          </DropdownItem>
        </>
      )}

      {percentage < 100 && (
        <DropdownItem>
          <StopIcon />
          Cancel
        </DropdownItem>
      )}

      {userIsReceiver && (
        <DropdownItem>
          <NoSymbolIcon />
          Prevent
        </DropdownItem>
      )}

      <DropdownItem>
        <TrashIcon />
        Delete
      </DropdownItem>
    </DropdownMenu>
  );
};

export default MessageDropdownMenu;
