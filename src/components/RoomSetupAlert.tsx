import { useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";

import p2party from "p2party";

import {
  Alert,
  AlertActions,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "./alert";
import { Button } from "./button";
import { Description, Label } from "./fieldset";
import { Input } from "./input";
import { Switch, SwitchField } from "./switch";
import {
  rememberRoomAccess,
  roomInvitePath,
} from "../protocol/roomAccess";
import { immediateRoomPolicy } from "../protocol/v3";

interface RoomSetupAlertProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const RoomSetupAlert = ({
  isOpen,
  setIsOpen,
}: RoomSetupAlertProps) => {
  const navigate = useNavigate();
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const close = () => {
    setPin("");
    setError("");
    setIsOpen(false);
  };

  const createRoom = async () => {
    if (pinEnabled && pin.length === 0) {
      setError("Enter a PIN, or switch PIN authentication off.");
      return;
    }

    setIsCreating(true);
    setError("");
    const pinBytes = pinEnabled ? new TextEncoder().encode(pin) : undefined;
    try {
      const roomUrl = await p2party.generateRandomRoomUrl();
      const policy = immediateRoomPolicy(pinEnabled ? "pin" : "nopin");
      rememberRoomAccess(roomUrl, policy, pinBytes);
      setPin("");
      setIsOpen(false);
      navigate(roomInvitePath(roomUrl, policy));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not make room");
    } finally {
      pinBytes?.fill(0);
      setIsCreating(false);
    }
  };

  return (
    <Alert open={isOpen} onClose={close} size='lg'>
      <AlertTitle>Create a protocol-v3 room</AlertTitle>
      <AlertDescription>
        Room security settings are authenticated at the first connection and
        cannot be silently changed later.
      </AlertDescription>
      <AlertBody className='space-y-5'>
        <div className='rounded-xl border border-orange-300/70 bg-orange-50/70 p-4 shadow-[3px_3px_0_0_rgba(249,115,22,0.16)] dark:border-orange-800/70 dark:bg-orange-950/25'>
          <SwitchField>
            <Label>Require a room PIN</Label>
            <Description>
              Adds CPace password authentication to every peer handshake. The
              PIN stays in memory only; share it separately from the room link.
            </Description>
            <Switch
              name='Require a room PIN'
              checked={pinEnabled}
              onChange={(enabled) => {
                setPinEnabled(enabled);
                if (!enabled) setPin("");
                setError("");
              }}
            />
          </SwitchField>

          {pinEnabled && (
            <div className='mt-4'>
              <Label htmlFor='new-room-pin'>Room PIN</Label>
              <Input
                id='new-room-pin'
                name='new-room-pin'
                type='password'
                autoComplete='new-password'
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value);
                  setError("");
                }}
                placeholder='Shared secret'
                aria-describedby='new-room-pin-help'
              />
              <p
                id='new-room-pin-help'
                className='mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400'
              >
                Never added to the URL, Redux, IndexedDB, logs, or analytics.
              </p>
            </div>
          )}
        </div>

        <fieldset>
          <legend className='text-sm font-semibold text-zinc-950 dark:text-white'>
            Room-wide traffic policy
          </legend>
          <div className='mt-2 grid gap-2 sm:grid-cols-2'>
            <div className='rounded-xl border-2 border-orange-500 bg-white p-3 dark:bg-zinc-950'>
              <div className='flex items-center justify-between gap-2'>
                <span className='font-mono text-sm font-semibold'>
                  Immediate
                </span>
                <span className='rounded bg-orange-500 px-2 py-0.5 font-mono text-[10px] font-bold text-white uppercase'>
                  default
                </span>
              </div>
              <p className='mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400'>
                Send now. Uniform cells and per-message padding remain active,
                but there is no timed cover stream.
              </p>
            </div>

            <div
              className='rounded-xl border border-dashed border-zinc-300 bg-zinc-100/70 p-3 opacity-70 dark:border-zinc-700 dark:bg-zinc-900/70'
              aria-disabled='true'
            >
              <div className='flex items-center justify-between gap-2'>
                <span className='font-mono text-sm font-semibold'>
                  Scheduled cover
                </span>
                <span className='rounded bg-zinc-700 px-2 py-0.5 font-mono text-[10px] font-bold text-white uppercase'>
                  not wired
                </span>
              </div>
              <p className='mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400'>
                10 s, 60 s, and 5 min room cadences are reserved in the public
                policy, but v0.10.0 refuses them until the scheduler ships.
              </p>
            </div>
          </div>
        </fieldset>

        <p className='font-mono text-xs leading-relaxed text-zinc-500 dark:text-zinc-400'>
          Fixed suite: interactive 3DH + ML-KEM-768 + Double Ratchet
          {pinEnabled ? " + CPace" : ""}. No downgrade negotiation.
        </p>

        {error && (
          <p
            role='alert'
            className='rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
          >
            {error}
          </p>
        )}
      </AlertBody>
      <AlertActions>
        <Button plain onClick={close} disabled={isCreating}>
          Cancel
        </Button>
        <Button
          color='orange'
          onClick={createRoom}
          disabled={isCreating}
        >
          {isCreating ? "Generating…" : "Generate room"}
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default RoomSetupAlert;
