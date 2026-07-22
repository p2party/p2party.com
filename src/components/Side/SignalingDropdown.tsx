import { useParams } from "react-router";

import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "../dropdown";
import { SidebarItem } from "../sidebar";

import { XMarkIcon, CheckIcon } from "@heroicons/react/20/solid";

import { useRoom } from "../../hooks/useRoom";

const SignalingDropdown = () => {
  const {
    stunServerUrls,
    signalingServerUrl,
    signalingServerConnectionState,
    connectToSignalingServer,
    disconnectFromSignalingServer,
  } = useRoom();
  const { roomUrl } = useParams();

  return (
    <Dropdown>
      <DropdownButton as={SidebarItem}>
        <span className='flex min-w-0 items-center gap-3'>
          <span className='min-w-0'>
            <span className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'>
              {signalingServerUrl}
            </span>
            {stunServerUrls?.map((v, i) => (
              <span
                key={i}
                className='block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400'
              >
                {v}
              </span>
            ))}
          </span>
        </span>
      </DropdownButton>
      <DropdownMenu className='min-w-64' anchor='bottom start'>
        {signalingServerConnectionState.isConnected && (
          <>
            <DropdownItem onClick={disconnectFromSignalingServer}>
              <XMarkIcon />
              Become undiscoverable
            </DropdownItem>

            {/*
              <DropdownItem>
                <NoSymbolIcon />
                Disconnect and stop receiving signaling info
              </DropdownItem>
            */}
          </>
        )}

        {!signalingServerConnectionState.isConnected && (
          <DropdownItem
            onClick={async () => await connectToSignalingServer(roomUrl ?? "")}
          >
            <CheckIcon />
            Become discoverable
          </DropdownItem>
        )}
      </DropdownMenu>
    </Dropdown>
  );
};

export default SignalingDropdown;
