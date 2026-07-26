import { useEffect, useState } from "react";

import p2party from "p2party";

import {
  Alert,
  AlertActions,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "../alert";
import { Button } from "../button";

import type { Dispatch, SetStateAction } from "react";

export interface RoomWordsAlertProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  roomUrl: string;
}

/**
 * Read the room's 24 invitation words back out of a live room.
 *
 * The words are not stored anywhere: they are one encoding of the same 256-bit
 * capability the room is already addressed by, so they are derived on demand
 * and dropped when the dialog closes. Someone who created a room in one tab
 * and wants to read the words aloud over a phone call has no other way to get
 * them, and a link is not always the channel you want to use.
 */
const RoomWordsAlert = ({
  isOpen,
  setIsOpen,
  roomUrl,
}: RoomWordsAlertProps) => {
  const [words, setWords] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || roomUrl.length === 0) return;
    let cancelled = false;
    let capability: Uint8Array | undefined;

    void (async () => {
      try {
        capability = p2party.decodeRoomCapability(roomUrl);
        const encoded = await p2party.encodeRoomCapabilityWords(capability);
        if (!cancelled) setWords(encoded);
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not derive the words for this room",
          );
      } finally {
        capability?.fill(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, roomUrl]);

  const close = () => {
    // The words are the room capability in another costume. Do not leave them
    // sitting in component state after the dialog is dismissed.
    setWords("");
    setError("");
    setCopied(false);
    setIsOpen(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(words);
      setCopied(true);
    } catch {
      setError("Could not copy. Select the words and copy them manually.");
    }
  };

  return (
    <Alert open={isOpen} onClose={close} size='xl'>
      <AlertTitle>Room invitation words</AlertTitle>
      <AlertDescription>
        Anyone holding these 24 words can join this room. Read them over a
        channel you trust, and send the PIN separately if the room has one.
      </AlertDescription>

      <AlertBody>
        {error ? (
          <p role='alert' className='text-sm text-red-600 dark:text-red-400'>
            {error}
          </p>
        ) : (
          <ol className='grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm sm:grid-cols-3'>
            {(words.length > 0
              ? words.split(" ")
              : Array<string>(24).fill("")
            ).map((word, index) => (
              <li key={index} className='flex gap-2 tabular-nums'>
                <span className='w-6 text-right text-zinc-400 dark:text-zinc-600'>
                  {index + 1}
                </span>
                <span className='text-zinc-950 dark:text-white'>
                  {word || "…"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </AlertBody>

      <AlertActions>
        <Button plain onClick={close}>
          Close
        </Button>
        <Button
          color='orange'
          onClick={() => void copy()}
          disabled={words.length === 0}
        >
          {copied ? "Copied" : "Copy words"}
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default RoomWordsAlert;
