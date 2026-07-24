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
import { Select } from "./select";
import { Switch, SwitchField } from "./switch";
import { rememberRoomAccess, roomInvitePath } from "../protocol/roomAccess";
import {
  immediateRoomPolicy,
  roomPqModeParameterSet,
  type RoomPqMode,
  type RoomPolicyV1,
} from "../protocol/v3";

interface RoomSetupAlertProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const RoomSetupAlert = ({ isOpen, setIsOpen }: RoomSetupAlertProps) => {
  const navigate = useNavigate();
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pin, setPin] = useState("");
  const [pqMode, setPqMode] = useState<RoomPqMode>("hybrid-mlkem768");
  const [inviteWords, setInviteWords] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const isWorking = isCreating || isJoining;

  const close = () => {
    setPin("");
    setInviteWords("");
    setError("");
    setIsOpen(false);
  };

  const selectedPolicy = (): RoomPolicyV1 =>
    immediateRoomPolicy(pinEnabled ? "pin" : "nopin", pqMode);

  const enterRoom = (
    capability: Uint8Array,
    policy: RoomPolicyV1,
    pinBytes?: Uint8Array,
  ) => {
    const compact = p2party.encodeRoomCapabilityBase64Url(capability);
    const roomUrl = p2party.normalizeRoomCapability(compact);
    rememberRoomAccess(roomUrl, policy, pinBytes);
    navigate(roomInvitePath(roomUrl, policy));
  };

  const createRoom = async () => {
    if (pinEnabled && pin.length === 0) {
      setError("Enter a PIN, or switch PIN authentication off.");
      return;
    }

    setIsCreating(true);
    setError("");
    const pinBytes = pinEnabled ? new TextEncoder().encode(pin) : undefined;
    let capability: Uint8Array | undefined;
    try {
      capability = p2party.generateRoomCapability();
      enterRoom(capability, selectedPolicy(), pinBytes);
      setPin("");
      setIsOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not make room");
    } finally {
      capability?.fill(0);
      pinBytes?.fill(0);
      setIsCreating(false);
    }
  };

  const joinRoomFromWords = async () => {
    if (inviteWords.trim().length === 0) {
      setError("Enter the 24 room invitation words.");
      return;
    }
    if (pinEnabled && pin.length === 0) {
      setError("Enter the room PIN, or switch PIN authentication off.");
      return;
    }

    setIsJoining(true);
    setError("");
    const pinBytes = pinEnabled ? new TextEncoder().encode(pin) : undefined;
    let capability: Uint8Array | undefined;
    try {
      capability = await p2party.decodeRoomCapabilityWords(inviteWords);
      enterRoom(capability, selectedPolicy(), pinBytes);
      setPin("");
      setInviteWords("");
      setIsOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join room");
    } finally {
      capability?.fill(0);
      pinBytes?.fill(0);
      setIsJoining(false);
    }
  };

  return (
    <Alert open={isOpen} onClose={close} size='lg'>
      <AlertTitle>Create or join a protocol-v3 room</AlertTitle>
      <AlertDescription>
        Room security settings are authenticated at the first connection and
        cannot be silently changed later.
      </AlertDescription>
      <AlertBody className='space-y-5'>
        <div>
          <Label htmlFor='room-mlkem-suite'>Room-wide ML-KEM suite</Label>
          <Description>
            Every peer uses this exact suite. It is authenticated in the room
            policy; there is no negotiation or downgrade fallback.
          </Description>
          <Select
            id='room-mlkem-suite'
            name='room-mlkem-suite'
            value={pqMode}
            onChange={(event) => setPqMode(event.target.value as RoomPqMode)}
            className='mt-2'
          >
            <option value='hybrid-mlkem512'>
              ML-KEM-512 — smaller/faster (NIST category 1)
            </option>
            <option value='hybrid-mlkem768'>
              ML-KEM-768 — balanced default (NIST category 3)
            </option>
            <option value='hybrid-mlkem1024'>
              ML-KEM-1024 — largest keys (NIST category 5)
            </option>
          </Select>
        </div>

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
                policy, but v0.11.0 refuses them until the scheduler ships.
              </p>
            </div>
          </div>
        </fieldset>

        <p className='font-mono text-xs leading-relaxed text-zinc-500 dark:text-zinc-400'>
          Fixed suite: interactive 3DH + ML-KEM-
          {roomPqModeParameterSet(pqMode)} + Double Ratchet
          {pinEnabled ? " + CPace" : ""}. No downgrade negotiation.
        </p>

        <div className='border-t border-zinc-300 pt-5 dark:border-zinc-700'>
          <Label htmlFor='room-invite-words'>Enter 24 invitation words</Label>
          <Description>
            Words carry the full 256-bit room capability plus a checksum. Match
            the sender&apos;s ML-KEM and PIN settings above; the words never
            enter the URL.
          </Description>
          <textarea
            id='room-invite-words'
            name='room-invite-words'
            rows={4}
            value={inviteWords}
            onChange={(event) => {
              setInviteWords(event.target.value);
              setError("");
            }}
            autoCapitalize='none'
            autoCorrect='off'
            spellCheck={false}
            placeholder='abandon ability able …'
            className='mt-2 block w-full rounded-lg border border-zinc-950/10 bg-white px-3 py-2 font-mono text-sm text-zinc-950 focus:outline-2 focus:outline-orange-500 dark:border-white/10 dark:bg-white/5 dark:text-white'
          />
          <Button
            outline
            onClick={joinRoomFromWords}
            disabled={isWorking}
            className='mt-3'
          >
            {isJoining ? "Checking words…" : "Join with 24 words"}
          </Button>
        </div>

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
        <Button plain onClick={close} disabled={isWorking}>
          Cancel
        </Button>
        <Button color='orange' onClick={createRoom} disabled={isWorking}>
          {isCreating ? "Generating…" : "Generate room"}
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default RoomSetupAlert;
