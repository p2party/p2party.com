import { useParams } from "react-router";

import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "../dropdown";
import { NavbarItem } from "../navbar";

import { SignalIcon, XMarkIcon } from "@heroicons/react/16/solid";

import { useRoom } from "../../hooks/useRoom";
import { CheckIcon, SignalSlashIcon } from "@heroicons/react/20/solid";

const SignalingDropdown = () => {
  const {
    signalingServerConnectionState,
    connectToSignalingServer,
    disconnectFromSignalingServer,
  } = useRoom();
  const { roomUrl } = useParams();

  return (
    <Dropdown>
      <DropdownButton as={NavbarItem}>
        {!signalingServerConnectionState.isConnected && <SignalSlashIcon />}

        {signalingServerConnectionState.isConnected && <SignalIcon />}
      </DropdownButton>
      <DropdownMenu className='min-w-64' anchor='bottom start'>
        {signalingServerConnectionState.isConnected && (
          <>
            <DropdownItem onClick={disconnectFromSignalingServer}>
              <XMarkIcon />
              Stop being discoverable
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
