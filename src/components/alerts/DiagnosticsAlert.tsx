import { useMemo } from "react";

import {
  Alert,
  AlertActions,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "../alert";
import { Button } from "../button";

import { useRoom } from "../../hooks/useRoom";
import { coverModeSummary, roomPqModeParameterSet } from "../../protocol/v4";

import type { Dispatch, ReactNode, SetStateAction } from "react";

export interface DiagnosticsAlertProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className='flex items-baseline justify-between gap-3 border-b border-zinc-200 py-1.5 last:border-b-0 dark:border-zinc-800'>
    <span className='shrink-0 text-zinc-500 dark:text-zinc-400'>{label}</span>
    <span className='text-right break-all text-zinc-950 dark:text-white'>
      {value}
    </span>
  </div>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className='mt-4 first:mt-0'>
    <h3 className='mb-1 font-mono text-[11px] font-bold tracking-[0.15em] text-orange-700 uppercase dark:text-orange-400'>
      {title}
    </h3>
    <div className='font-mono text-xs'>{children}</div>
  </section>
);

const HANDSHAKE_LABEL: Record<string, string> = {
  authenticating: "authenticating…",
  authenticated: "authenticated",
  failed: "failed",
};

/**
 * Everything the library actually reports about this room, in one place:
 * per-peer authentication and cover state, the authenticated policy, and
 * per-transfer cell counts. Every number here comes from the SDK — nothing
 * is estimated, and a value the library does not report is shown as "—"
 * rather than guessed.
 */
const DiagnosticsAlert = ({ isOpen, setIsOpen }: DiagnosticsAlertProps) => {
  const {
    roomId,
    roomUrl,
    roomPolicy,
    peers,
    channels,
    messages,
    coverStatusByPeer,
    handshakeStatusByPeer,
    signalingServerConnectionState,
    signalingServerUrl,
    peerId,
  } = useRoom();

  const totals = useMemo(() => {
    let cells = 0;
    let real = 0;
    let retransmits = 0;
    let bytes = 0;
    for (const message of messages) {
      cells += message.chunksReceivedTotal ?? 0;
      real += message.chunksReceivedReal ?? 0;
      retransmits += message.retransmits ?? 0;
      bytes += message.savedSize;
    }
    return { cells, real, retransmits, bytes };
  }, [messages]);

  const decoys = totals.cells - totals.real;

  return (
    <Alert open={isOpen} onClose={setIsOpen} size='2xl'>
      <AlertTitle>Advanced diagnostics</AlertTitle>
      <AlertDescription>
        Live protocol state for this room, straight from the SDK. Nothing here
        leaves your device.
      </AlertDescription>
      <AlertBody>
        <Section title='Session'>
          <Row label='Your peer id' value={peerId || "—"} />
          <Row label='Room id' value={roomId || "not joined"} />
          <Row
            label='Room capability'
            value={roomUrl ? `${roomUrl.slice(0, 16)}…` : "—"}
          />
          <Row
            label='Signaling'
            // An open socket is not an authenticated one: the library gates the
            // peer-list request on isVerified, so the two states differ.
            value={`${
              signalingServerConnectionState.isConnected
                ? signalingServerConnectionState.isVerified
                  ? "connected · identity verified"
                  : "connected · NOT verified"
                : "disconnected"
            } · ${signalingServerUrl}`}
          />
        </Section>

        <Section title='Authenticated room policy'>
          <Row label='Protocol' value={`v${String(roomPolicy.wireVersion)}`} />
          <Row
            label='Key exchange'
            value={`3DH + ML-KEM-${String(roomPqModeParameterSet(roomPolicy.pqMode))} (hybrid)`}
          />
          <Row
            label='Room PIN'
            value={roomPolicy.authMode === "pin" ? "required (CPace)" : "none"}
          />
          <Row label='Traffic' value={coverModeSummary(roomPolicy)} />
          {roomPolicy.coverMode === "scheduled" && (
            <Row
              label='Cover schedule'
              value={`${String(roomPolicy.coverCadenceMs / 1000)} s cycle · ${String(roomPolicy.coverLanes)} lanes × ${String(roomPolicy.coverFramesPerCell)} cells × ${String(roomPolicy.coverDurationEpochs)} epochs`}
            />
          )}
        </Section>

        <Section title={`Peer connections (${String(peers.length)})`}>
          {peers.length === 0 ? (
            <p className='py-1.5 text-zinc-500 dark:text-zinc-400'>
              No peers yet.
            </p>
          ) : (
            peers.map((peer) => {
              const handshake = handshakeStatusByPeer[peer.peerId];
              const cover = coverStatusByPeer[peer.peerId];
              return (
                <div
                  key={peer.peerId}
                  className='mt-2 border border-zinc-200 p-2 first:mt-0 dark:border-zinc-800'
                >
                  <Row label='Peer id' value={peer.peerId} />
                  <Row
                    label='Identity key'
                    value={`${peer.peerPublicKey.slice(0, 16)}…`}
                  />
                  <Row
                    label='Handshake'
                    value={
                      handshake
                        ? `${HANDSHAKE_LABEL[handshake.status]}${handshake.reason ? ` (${handshake.reason})` : ""}`
                        : "—"
                    }
                  />
                  <Row
                    label='Scheduled cover'
                    value={
                      roomPolicy.coverMode === "scheduled"
                        ? (cover ?? "not started")
                        : "n/a (immediate mode)"
                    }
                  />
                </div>
              );
            })
          )}
        </Section>

        <Section title='Traffic'>
          <Row label='Open channels' value={String(channels.length)} />
          <Row label='Messages in this room' value={String(messages.length)} />
          <Row
            label='Cells received'
            value={
              totals.cells > 0
                ? `${String(totals.cells)} total · ${String(totals.real)} real · ${String(decoys)} cover`
                : "—"
            }
          />
          <Row
            label='Retransmit rounds'
            value={totals.cells > 0 ? String(totals.retransmits) : "—"}
          />
          <Row
            label='Payload stored'
            value={`${String(Math.round(totals.bytes / 1024))} KiB`}
          />
        </Section>

        <Section title='Per message'>
          {messages.length === 0 ? (
            <p className='py-1.5 text-zinc-500 dark:text-zinc-400'>
              No messages yet.
            </p>
          ) : (
            [...messages]
              .slice(-12)
              .reverse()
              .map((message) => (
                <Row
                  key={`${message.sha512Hex}-${String(message.timestamp)}`}
                  label={`${message.filename.slice(0, 24)} · ${String(Math.round((message.savedSize / Math.max(1, message.totalSize)) * 100))}%`}
                  value={
                    message.chunksReceivedTotal !== undefined
                      ? `${String(message.chunksReceivedReal ?? 0)}/${String(message.chunksReceivedTotal)} real · ${String(message.retransmits ?? 0)} retx`
                      : `${String(message.chunksCreated)}/${String(message.totalChunks)} cells sent`
                  }
                />
              ))
          )}
        </Section>
      </AlertBody>
      <AlertActions>
        <Button plain onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default DiagnosticsAlert;
