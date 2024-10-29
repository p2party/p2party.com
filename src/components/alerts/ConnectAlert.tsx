import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
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
    <Alert open={isOpen} onClose={setIsOpen} size='lg'>
      <AlertTitle>Connecting to a room</AlertTitle>
      <AlertDescription className='text-justify text-zinc-950 dark:text-white'>
        You first need to connect to the p2party.com signaling servers in order
        to discover other peers in the same room. In order to establish WebRTC
        connections, information about your browser's networking capabilities
        will be relayed to your potential future peers, including your IP
        address. By default, you become a relay yourself through the "signaling"
        data channel, which you can close anytime.
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
