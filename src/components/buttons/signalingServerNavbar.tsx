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

const SignalingServerNavigationButton = () => {
  const { signalingServerConnectionState, disconnectFromSignalingServer } =
    useRoom({ subscribeToMessages: false });

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
              Disconnect from signaling server
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
          <DropdownItem>
            <CheckIcon />
            Connect to signaling server
          </DropdownItem>
        )}
      </DropdownMenu>
    </Dropdown>
  );
};

export default SignalingServerNavigationButton;
