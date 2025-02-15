import {
  Alert,
  AlertActions,
  AlertDescription,
  // AlertTitle,
  AlertBody,
} from "../alert";
import { Link } from "../link";
import { Button } from "../button";

import { useRoom } from "../../hooks/useRoom";

import type { Dispatch, SetStateAction } from "react";

export interface ConnectAlertProps {
  roomUrl: string;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const ConnectAlert = ({ roomUrl, isOpen, setIsOpen }: ConnectAlertProps) => {
  const { connect } = useRoom();

  const handleConnectNow = () => {
    connect(roomUrl);
    setIsOpen(false);
  };

  return (
    <Alert open={isOpen} onClose={setIsOpen} size='md'>
      <AlertDescription className='text-justify text-zinc-950 dark:text-white'>
        You are about to connect to signaling.p2party.com to discover peers in
        the same URL. To establish a WebRTC connection, information about your
        device's networking capabilities, such as your IP address, need to be
        relayed to your peers. You can blacklist users or only allow connections
        from your address book. If you wish to connect to your own signaling
        server or another STUN/TURN service, click Cancel and go to the related
        sidebar section.
      </AlertDescription>
      <AlertBody>
        By continuing, you agree to the{" "}
        <Link
          href={"/privacy-policy"}
          target='_blank'
          rel='noopener noreferrer'
          className='text-zinc-500 underline'
        >
          Privacy Policy
        </Link>{" "}
        and the{" "}
        <Link
          href={"/terms-of-service"}
          target='_blank'
          rel='noopener noreferrer'
          className='text-zinc-500 underline'
        >
          Terms of Service
        </Link>
        .
      </AlertBody>
      <AlertActions>
        <Button plain onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
        <Button autoFocus onClick={handleConnectNow}>
          Connect
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default ConnectAlert;
