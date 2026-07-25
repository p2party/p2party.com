import { useState } from "react";

import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
  AlertBody,
} from "../alert";
import { Link } from "../link";
import { Button } from "../button";
import { Input } from "../input";

import { useRoom } from "../../hooks/useRoom";
import {
  hasTransientRoomPin,
  rememberRoomAccess,
} from "../../protocol/roomAccess";
import { coverModeSummary, roomPqModeParameterSet } from "../../protocol/v4";

import type { Dispatch, SetStateAction } from "react";

export interface ConnectAlertProps {
  roomUrl: string;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  setPressedCancel: Dispatch<SetStateAction<boolean>>;
}

const ConnectAlert = ({
  roomUrl,
  isOpen,
  setIsOpen,
  setPressedCancel,
}: ConnectAlertProps) => {
  const { connect, signalingServerUrl, roomPolicy } = useRoom({
    subscribeToMessages: false,
  });
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const pinRequired = roomPolicy.authMode === "pin";
  const pinIsLoaded = hasTransientRoomPin(roomUrl);

  const handleConnectNow = async () => {
    if (pinRequired && pin.length === 0 && !pinIsLoaded) {
      setError("Enter the room PIN before connecting.");
      return;
    }

    setIsConnecting(true);
    setError("");
    const pinBytes =
      pinRequired && pin.length > 0 ? new TextEncoder().encode(pin) : undefined;
    try {
      if (pinBytes) rememberRoomAccess(roomUrl, roomPolicy, pinBytes);
      else if (!pinRequired) rememberRoomAccess(roomUrl, roomPolicy);
      await connect(roomUrl);
      setPin("");
      setIsOpen(false);
      setPressedCancel(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connection failed");
    } finally {
      pinBytes?.fill(0);
      setIsConnecting(false);
    }
  };

  const handleCancelConnect = () => {
    setIsOpen(false);
    setPressedCancel(true);
  };

  return (
    <Alert open={isOpen} onClose={setIsOpen} size='sm' className='lg:ml-64'>
      <AlertTitle>
        {pinRequired ? "Join PIN-authenticated room" : "Join room"}
      </AlertTitle>
      <AlertDescription className='text-justify text-zinc-950 dark:text-white'>
        You are about to connect to {signalingServerUrl} to discover peers in
        the same URL. To establish a WebRTC connection, information about your
        device's networking capabilities, such as your IP address, need to be
        relayed to your peers. You can blacklist users or only allow connections
        from your address book. If you wish to connect to your own signaling
        server or another STUN/TURN service, click Cancel and go to Settings.
      </AlertDescription>
      <AlertBody>
        {pinRequired && (
          <div className='mb-4 rounded-xl border border-orange-300/70 bg-orange-50/70 p-3 dark:border-orange-800/70 dark:bg-orange-950/25'>
            <label
              htmlFor='join-room-pin'
              className='text-sm font-semibold text-zinc-950 dark:text-white'
            >
              Room PIN
            </label>
            <Input
              id='join-room-pin'
              name='join-room-pin'
              type='password'
              autoComplete='off'
              value={pin}
              onChange={(event) => {
                setPin(event.target.value);
                setError("");
              }}
              placeholder={
                pinIsLoaded ? "PIN already loaded in memory" : "Shared secret"
              }
              className='mt-2'
            />
            <p className='mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400'>
              CPace verifies the shared PIN without sending it. It is held in
              memory only and never included in the invitation link.
            </p>
          </div>
        )}

        <p>
          Room policy: hybrid ML-KEM-{roomPqModeParameterSet(roomPolicy.pqMode)}{" "}
          + interactive 3DH, {coverModeSummary(roomPolicy)}
          {pinRequired ? ", CPace PIN authentication" : ""}.
        </p>

        <p className='mt-3'>
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
        </p>

        {error && (
          <p
            role='alert'
            className='mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
          >
            {error}
          </p>
        )}
      </AlertBody>
      <AlertActions>
        <Button plain onClick={handleCancelConnect} disabled={isConnecting}>
          Cancel
        </Button>
        <Button
          autoFocus={!pinRequired}
          onClick={handleConnectNow}
          disabled={isConnecting}
        >
          {isConnecting ? "Connecting…" : "Connect"}
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default ConnectAlert;
