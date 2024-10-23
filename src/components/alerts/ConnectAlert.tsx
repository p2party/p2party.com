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
      <AlertTitle>Connect to a room</AlertTitle>
      <AlertDescription className='text-zinc-950 dark:text-white'>
        First you will need to connect to the p2party.com signaling servers in
        order to be discoverable by other peers in the same room. In order to
        establish WebRTC connections, information about the networking
        capabilities of your browser will be relayed by the server to your
        potential future peers, including your public IP address.
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
        <Button onClick={handleConnectNow}>Connect</Button>
      </AlertActions>
    </Alert>
  );
};

export default ConnectAlert;
