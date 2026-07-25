import { useEffect, useState } from "react";

import {
  Alert,
  AlertActions,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "../alert";
import { Button } from "../button";

import {
  computeSafetyNumber,
  formatKeyForDisplay,
  type SafetyNumber,
} from "../../protocol/safetyNumber";

import type { Dispatch, SetStateAction } from "react";

export interface VerifyIdentityAlertProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  localPublicKey: string;
  localPeerId: string;
  peerPublicKey: string;
  peerId: string;
  peerLabel: string;
  /** The key recorded when this contact was saved, if they are saved. */
  storedPublicKey?: string;
  onMarkVerified?: () => void;
}

const VerifyIdentityAlert = ({
  isOpen,
  setIsOpen,
  localPublicKey,
  localPeerId,
  peerPublicKey,
  peerId,
  peerLabel,
  storedPublicKey,
  onMarkVerified,
}: VerifyIdentityAlertProps) => {
  // Keyed by the inputs it was derived from, so a change renders "deriving"
  // without the effect having to synchronously clear state first.
  const [result, setResult] = useState<{
    key: string;
    value?: SafetyNumber;
    error?: string;
  }>({ key: "" });

  const keyChanged =
    storedPublicKey !== undefined &&
    storedPublicKey.length > 0 &&
    storedPublicKey.toLowerCase() !== peerPublicKey.toLowerCase();

  const derivationKey = `${localPublicKey}:${localPeerId}:${peerPublicKey}:${peerId}`;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    computeSafetyNumber(localPublicKey, localPeerId, peerPublicKey, peerId)
      .then((value) => {
        if (!cancelled) setResult({ key: derivationKey, value });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setResult({
          key: derivationKey,
          error:
            cause instanceof Error
              ? cause.message
              : "Could not derive a safety number for this peer.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    localPublicKey,
    localPeerId,
    peerPublicKey,
    peerId,
    derivationKey,
  ]);

  const fresh = result.key === derivationKey;
  const safetyNumber = fresh ? result.value : undefined;
  const error = fresh ? (result.error ?? "") : "";

  return (
    <Alert open={isOpen} onClose={() => setIsOpen(false)} size='xl'>
      <AlertTitle>Verify {peerLabel}</AlertTitle>
      <AlertDescription>
        Compare these numbers with {peerLabel} over a channel this app does not
        control: in person, or on a call where you recognise their voice. If
        they match, no one is sitting between you.
      </AlertDescription>

      <AlertBody>
        {keyChanged && (
          <div
            role='alert'
            className='mb-4 border-2 border-red-500 bg-red-50 p-3 text-sm dark:bg-red-950'
          >
            <p className='font-semibold text-red-700 dark:text-red-200'>
              This contact&rsquo;s identity key has changed.
            </p>
            <p className='mt-1 text-red-700 dark:text-red-300'>
              You saved a different key for this contact. That happens if they
              reset their profile or use a new device, and it is also what an
              impersonation attempt looks like. Verify the new numbers before
              you trust this conversation.
            </p>
          </div>
        )}

        {error.length > 0 && (
          <p role='alert' className='text-sm text-red-600 dark:text-red-400'>
            {error}
          </p>
        )}

        {!error && !safetyNumber && (
          <p className='text-sm text-zinc-500 dark:text-zinc-400'>
            Deriving safety number&hellip;
          </p>
        )}

        {safetyNumber && (
          <>
            <div className='grid grid-cols-3 gap-2 border-2 border-zinc-950 p-3 font-mono text-base tracking-widest sm:grid-cols-4 dark:border-zinc-200'>
              {safetyNumber.groups.map((group, index) => (
                <span
                  key={`${group}-${String(index)}`}
                  className='text-center text-zinc-950 dark:text-white'
                >
                  {group}
                </span>
              ))}
            </div>

            <dl className='mt-4 space-y-2 text-xs'>
              <div>
                <dt className='text-zinc-500 dark:text-zinc-400'>
                  Their identity key
                </dt>
                <dd className='font-mono break-all text-zinc-950 dark:text-white'>
                  {formatKeyForDisplay(peerPublicKey)}
                </dd>
              </div>
              <div>
                <dt className='text-zinc-500 dark:text-zinc-400'>
                  Your identity key
                </dt>
                <dd className='font-mono break-all text-zinc-950 dark:text-white'>
                  {formatKeyForDisplay(localPublicKey)}
                </dd>
              </div>
            </dl>

            <p className='mt-4 text-xs text-zinc-500 dark:text-zinc-400'>
              Both of you see the same 60 digits in the same order. A number
              that does not match means the keys you each hold are not the pair
              you think they are.
            </p>
          </>
        )}
      </AlertBody>

      <AlertActions>
        {safetyNumber && onMarkVerified && (
          <Button
            onClick={() => {
              onMarkVerified();
              setIsOpen(false);
            }}
          >
            They match
          </Button>
        )}
        <Button plain onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default VerifyIdentityAlert;
