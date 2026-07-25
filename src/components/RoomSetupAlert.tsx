import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from "react";
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
import { Description, Field, Label } from "./fieldset";
import { Input } from "./input";
import { Select } from "./select";
import { Switch, SwitchField } from "./switch";
import { rememberRoomAccess, roomInvitePath } from "../protocol/roomAccess";
import {
  coverBytesPerCycle,
  coverSlotMs,
  COVER_LIMITS,
  immediateRoomPolicyFrom,
  roomPqModeParameterSet,
  scheduledCoverPresetById,
  scheduledRoomPolicyFrom,
  SCHEDULED_COVER_PRESETS,
  validateCoverSchedule,
  type CoverSchedule,
  type RoomPqMode,
  type RoomPolicyV1,
  type RoomRendezvousMode,
} from "../protocol/v4";

interface RoomSetupAlertProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const RoomSetupAlert = ({ isOpen, setIsOpen }: RoomSetupAlertProps) => {
  const navigate = useNavigate();
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pin, setPin] = useState("");
  const [pqMode, setPqMode] = useState<RoomPqMode>("hybrid-mlkem768");
  const [coverEnabled, setCoverEnabled] = useState(false);
  const [coverPresetId, setCoverPresetId] = useState("60s");
  const [advanced, setAdvanced] = useState(false);
  const [rendezvousMode, setRendezvousMode] =
    useState<RoomRendezvousMode>("legacy-signaling");
  const [revision, setRevision] = useState(0);
  const [schedule, setSchedule] = useState<CoverSchedule>(() => {
    const preset = scheduledCoverPresetById("60s");
    return {
      coverCadenceMs: preset?.coverCadenceMs ?? 60_000,
      coverLanes: preset?.coverLanes ?? 2,
      coverFramesPerCell: preset?.coverFramesPerCell ?? 32,
      coverDurationEpochs: preset?.coverDurationEpochs ?? 1,
    };
  });
  const [wordSample, setWordSample] = useState("");
  const immediateCardRef = useRef<HTMLButtonElement>(null);
  const scheduledCardRef = useRef<HTMLButtonElement>(null);

  const selectCoverCard = (enabled: boolean) => {
    setCoverEnabled(enabled);
    setError("");
    (enabled ? scheduledCardRef : immediateCardRef).current?.focus();
  };

  // ARIA radio-group keyboard contract: one tab stop (the checked radio) and
  // arrow keys move the selection.
  const handleCoverGroupKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      selectCoverCard(!coverEnabled);
    }
  };
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

  const applyPreset = (id: string) => {
    setCoverPresetId(id);
    const preset = scheduledCoverPresetById(id);
    if (preset)
      setSchedule({
        coverCadenceMs: preset.coverCadenceMs,
        coverLanes: preset.coverLanes,
        coverFramesPerCell: preset.coverFramesPerCell,
        coverDurationEpochs: preset.coverDurationEpochs,
      });
    setError("");
  };

  // The advanced view edits the schedule directly; the default view drives the
  // same fields through presets, so both produce one policy.
  const scheduleError = coverEnabled ? validateCoverSchedule(schedule) : "";

  const selectedPolicy = (): RoomPolicyV1 => {
    const authMode = pinEnabled ? "pin" : "nopin";
    if (!coverEnabled)
      return immediateRoomPolicyFrom(
        authMode,
        pqMode,
        rendezvousMode,
        revision,
      );
    if (scheduleError) throw new Error(scheduleError);
    return scheduledRoomPolicyFrom(
      authMode,
      pqMode,
      schedule,
      rendezvousMode,
      revision,
    );
  };

  // A live sample from the real BIP39 list: encode a throwaway capability and
  // show its first words, so the placeholder is never mistaken for a fixed
  // prefix every room shares.
  const refreshWordSample = async () => {
    let capability: Uint8Array | undefined;
    try {
      capability = p2party.generateRoomCapability();
      const words = await p2party.encodeRoomCapabilityWords(capability);
      setWordSample(words.split(" ").slice(0, 3).join(" ") + " …");
    } catch {
      setWordSample("");
    } finally {
      capability?.fill(0);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const capability = p2party.generateRoomCapability();
    p2party
      .encodeRoomCapabilityWords(capability)
      .then((words) => {
        if (!cancelled)
          setWordSample(words.split(" ").slice(0, 3).join(" ") + " …");
      })
      .catch(() => {
        // A sample is decoration; the field still works without one.
      })
      .finally(() => {
        capability.fill(0);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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
    <Alert open={isOpen} onClose={close} size='3xl'>
      <AlertTitle>Create or join a protocol-v4 room</AlertTitle>
      <AlertDescription>
        Room security settings are authenticated at the first connection and
        cannot be silently changed later.
      </AlertDescription>

      <div
        role='tablist'
        aria-label='Room settings detail'
        className='mt-4 flex border-2 border-zinc-950 dark:border-zinc-200'
      >
        {[
          { id: false, label: "Default" },
          { id: true, label: "Advanced" },
        ].map((view) => (
          <button
            key={String(view.id)}
            type='button'
            role='tab'
            aria-selected={advanced === view.id}
            onClick={() => {
              setAdvanced(view.id);
              setError("");
            }}
            className={
              "flex-1 px-4 py-2 font-mono text-xs font-bold tracking-[0.12em] uppercase transition-colors " +
              (advanced === view.id
                ? "bg-darkOrange text-white"
                : "bg-white text-zinc-600 hover:text-zinc-950 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-white")
            }
          >
            {view.label}
          </button>
        ))}
      </div>
      <AlertBody className='space-y-5'>
        <Field>
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
        </Field>

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
            <Field className='mt-4'>
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
            </Field>
          )}
        </div>

        <fieldset>
          <legend className='text-sm font-semibold text-zinc-950 dark:text-white'>
            Room-wide traffic policy
          </legend>
          <div
            role='radiogroup'
            aria-label='Room-wide traffic policy'
            onKeyDown={handleCoverGroupKeyDown}
            className='mt-2 grid gap-2 sm:grid-cols-2'
          >
            <button
              type='button'
              role='radio'
              ref={immediateCardRef}
              aria-checked={!coverEnabled}
              aria-label='Immediate'
              aria-describedby='cover-immediate-description'
              tabIndex={!coverEnabled ? 0 : -1}
              onClick={() => selectCoverCard(false)}
              className={
                !coverEnabled
                  ? "rounded-xl border-2 border-orange-500 bg-white p-3 text-left dark:bg-zinc-950"
                  : "rounded-xl border-2 border-zinc-300 bg-white p-3 text-left hover:border-orange-400 dark:border-zinc-700 dark:bg-zinc-950"
              }
            >
              <div className='flex items-center justify-between gap-2'>
                <span className='font-mono text-sm font-semibold'>
                  Immediate
                </span>
                <span
                  className={
                    "rounded bg-orange-500 px-2 py-0.5 font-mono text-[10px] font-bold text-white uppercase" +
                    (!coverEnabled ? "" : " invisible")
                  }
                >
                  selected
                </span>
              </div>
              <p
                id='cover-immediate-description'
                className='mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400'
              >
                Send now. Uniform cells and per-message padding remain active,
                but there is no timed cover stream.
              </p>
            </button>

            <button
              type='button'
              role='radio'
              ref={scheduledCardRef}
              aria-checked={coverEnabled}
              aria-label='Scheduled cover'
              aria-describedby='cover-scheduled-description'
              tabIndex={coverEnabled ? 0 : -1}
              onClick={() => selectCoverCard(true)}
              className={
                coverEnabled
                  ? "rounded-xl border-2 border-orange-500 bg-white p-3 text-left dark:bg-zinc-950"
                  : "rounded-xl border-2 border-zinc-300 bg-white p-3 text-left hover:border-orange-400 dark:border-zinc-700 dark:bg-zinc-950"
              }
            >
              <div className='flex items-center justify-between gap-2'>
                <span className='font-mono text-sm font-semibold'>
                  Scheduled cover
                </span>
                <span
                  className={
                    "rounded bg-orange-500 px-2 py-0.5 font-mono text-[10px] font-bold text-white uppercase" +
                    (coverEnabled ? "" : " invisible")
                  }
                >
                  selected
                </span>
              </div>
              <p
                id='cover-scheduled-description'
                className='mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400'
              >
                Every peer edge streams authenticated uniform cells on a fixed
                cadence; real traffic substitutes into already-scheduled slots,
                so message timing is not observable.
              </p>
            </button>
          </div>

          {coverEnabled && !advanced && (
            <Field className='mt-3'>
              <Label htmlFor='room-cover-cadence'>Cover cadence</Label>
              <Description>
                The cycle length is authenticated in the room policy and shared
                inside the room link; every peer follows the same schedule.
              </Description>
              <Select
                id='room-cover-cadence'
                name='room-cover-cadence'
                value={coverPresetId}
                onChange={(event) => applyPreset(event.target.value)}
                className='mt-2'
              >
                {SCHEDULED_COVER_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label} — {preset.description}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </fieldset>

        {advanced && (
          <div className='space-y-4 border-2 border-zinc-950 p-4 dark:border-zinc-200'>
            <p className='font-mono text-[11px] font-bold tracking-[0.15em] text-orange-700 uppercase dark:text-orange-400'>
              every field the policy carries
            </p>

            {coverEnabled ? (
              <div className='grid gap-3 sm:grid-cols-2'>
                {(
                  [
                    {
                      key: "coverCadenceMs",
                      label: "Cycle length (ms)",
                      min: COVER_LIMITS.minCadenceMs,
                      max: COVER_LIMITS.maxCadenceMs,
                    },
                    {
                      key: "coverLanes",
                      label: "Lanes per peer",
                      min: 1,
                      max: COVER_LIMITS.maxLanes,
                    },
                    {
                      key: "coverFramesPerCell",
                      label: "Cells per lane",
                      min: 1,
                      max: COVER_LIMITS.maxFramesPerCell,
                    },
                    {
                      key: "coverDurationEpochs",
                      label: "Epochs per cycle",
                      min: 1,
                      max: 65535,
                    },
                  ] as const
                ).map((field) => (
                  <Field key={field.key}>
                    <Label htmlFor={`cover-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`cover-${field.key}`}
                      name={`cover-${field.key}`}
                      type='number'
                      min={field.min}
                      max={field.max}
                      value={schedule[field.key]}
                      onChange={(event) => {
                        setSchedule((previous) => ({
                          ...previous,
                          [field.key]: Number(event.target.value),
                        }));
                        setCoverPresetId("custom");
                        setError("");
                      }}
                    />
                  </Field>
                ))}
              </div>
            ) : (
              <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                The schedule fields apply to scheduled cover; this room sends
                immediately, so the policy stores them as zero.
              </p>
            )}

            {coverEnabled && (
              <p
                className={
                  "font-mono text-[11px] leading-relaxed " +
                  (scheduleError
                    ? "text-red-700 dark:text-red-400"
                    : "text-zinc-500 dark:text-zinc-400")
                }
              >
                {scheduleError ||
                  `${coverSlotMs(schedule).toFixed(1)} ms between cells on a lane · ${String(Math.round(coverBytesPerCycle(schedule) / 1024))} KiB per cycle per peer`}
              </p>
            )}

            <Field>
              <Label htmlFor='room-rendezvous'>Rendezvous</Label>
              <Description>
                How peers find each other. Private rendezvous has a reserved
                policy code but no implementation yet, so it cannot be selected.
              </Description>
              <Select
                id='room-rendezvous'
                name='room-rendezvous'
                value={rendezvousMode}
                onChange={(event) => {
                  setRendezvousMode(event.target.value as RoomRendezvousMode);
                }}
                className='mt-2'
              >
                <option value='legacy-signaling'>
                  Signaling server introduces peers
                </option>
                <option value='opaque-token' disabled>
                  Opaque token — not implemented
                </option>
                <option value='blind-meeting-point' disabled>
                  Blind meeting point — not implemented
                </option>
              </Select>
            </Field>

            <Field>
              <Label htmlFor='room-revision'>Policy revision</Label>
              <Description>
                Authenticated with the policy. Both sides must use the same
                number; it exists to distinguish otherwise identical rooms.
              </Description>
              <Input
                id='room-revision'
                name='room-revision'
                type='number'
                min={0}
                value={revision}
                onChange={(event) => {
                  setRevision(Math.max(0, Number(event.target.value)));
                  setError("");
                }}
                className='mt-2'
              />
            </Field>
          </div>
        )}

        <p className='font-mono text-xs leading-relaxed text-zinc-500 dark:text-zinc-400'>
          Fixed suite: interactive 3DH + ML-KEM-
          {roomPqModeParameterSet(pqMode)} + Double Ratchet
          {pinEnabled ? " + CPace" : ""}
          {coverEnabled ? " + scheduled timing cover" : ""}. No downgrade
          negotiation.
        </p>

        <Field className='block border-t border-zinc-300 pt-5 dark:border-zinc-700'>
          <Label htmlFor='room-invite-words'>Enter 24 invitation words</Label>
          <Description>
            Words carry the full 256-bit room capability plus a checksum. Match
            the sender&apos;s ML-KEM, PIN, and traffic-policy settings above
            exactly — a mismatch fails the authenticated handshake. The words
            never enter the URL.
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
            placeholder={wordSample || "loading a sample…"}
            className='mt-2 block w-full rounded-lg border border-zinc-950/10 bg-white px-3 py-2 font-mono text-sm text-zinc-950 focus:outline-2 focus:outline-orange-500 dark:border-white/10 dark:bg-white/5 dark:text-white'
          />
          <div className='mt-3 flex flex-wrap items-center gap-2'>
            <Button
              outline
              onClick={joinRoomFromWords}
              disabled={isWorking || scheduleError.length > 0}
            >
              {isJoining ? "Checking words…" : "Join with 24 words"}
            </Button>
            <button
              type='button'
              onClick={() => void refreshWordSample()}
              className='font-mono text-xs text-zinc-500 underline decoration-dotted underline-offset-4 hover:text-orange-700 dark:text-zinc-400 dark:hover:text-orange-300'
            >
              show another sample
            </button>
          </div>
        </Field>

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
        <Button
          color='orange'
          onClick={createRoom}
          disabled={isWorking || scheduleError.length > 0}
        >
          {isCreating ? "Generating…" : "Generate room"}
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default RoomSetupAlert;
