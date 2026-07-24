import { useState } from "react";

import {
  createSession,
  generateSessionIdentity,
  restoreSession,
  type GeneratedSessionIdentity,
  type HandshakeTransport,
  type P2PartySession,
} from "p2party/session";

import { Button } from "../components/button";
import { Link } from "../components/link";

const makeLink = () => {
  const queued: Uint8Array[] = [];
  const waiters: Array<(bytes: Uint8Array) => void> = [];
  return {
    send(bytes: Uint8Array): void {
      const owned = Uint8Array.from(bytes);
      const waiter = waiters.shift();
      if (waiter) waiter(owned);
      else queued.push(owned);
    },
    recv(): Promise<Uint8Array> {
      const bytes = queued.shift();
      return bytes
        ? Promise.resolve(bytes)
        : new Promise((resolve) => waiters.push(resolve));
    },
  };
};

interface DemoResult {
  protocolVersion: number;
  forwardPlaintext: string;
  reversePlaintext: string;
  frameCount: number;
  frameBytes: number;
  snapshotBytes: number;
}

const SessionLabPage = () => {
  const [message, setMessage] = useState("hello from a store-free session");
  const [result, setResult] = useState<DemoResult>();
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const runDemo = async () => {
    if (message.length === 0) {
      setError("Enter a message first.");
      return;
    }

    setIsRunning(true);
    setError("");
    setResult(undefined);

    let aliceIdentity: GeneratedSessionIdentity | undefined;
    let bobIdentity: GeneratedSessionIdentity | undefined;
    let alice: P2PartySession | undefined;
    let bob: P2PartySession | undefined;
    let restoredAlice: P2PartySession | undefined;
    let snapshot: Uint8Array | undefined;

    try {
      [aliceIdentity, bobIdentity] = await Promise.all([
        generateSessionIdentity(),
        generateSessionIdentity(),
      ]);

      const aliceToBob = makeLink();
      const bobToAlice = makeLink();
      const channelId = crypto.getRandomValues(new Uint8Array(16));
      const aliceFingerprint = crypto.getRandomValues(new Uint8Array(32));
      const bobFingerprint = crypto.getRandomValues(new Uint8Array(32));
      const transport = (
        send: (bytes: Uint8Array) => void,
        recv: () => Promise<Uint8Array>,
      ): HandshakeTransport => ({ send, recv });

      [alice, bob] = await Promise.all([
        createSession({
          role: "initiator",
          identity: aliceIdentity,
          peerIdentityEd25519PublicKey: bobIdentity.ed25519PublicKey,
          channel: {
            channelId,
            localFingerprint: aliceFingerprint,
            remoteFingerprint: bobFingerprint,
          },
          transport: transport(aliceToBob.send, bobToAlice.recv),
          mode: "nopin",
        }),
        createSession({
          role: "responder",
          identity: bobIdentity,
          peerIdentityEd25519PublicKey: aliceIdentity.ed25519PublicKey,
          channel: {
            channelId,
            localFingerprint: bobFingerprint,
            remoteFingerprint: aliceFingerprint,
          },
          transport: transport(bobToAlice.send, aliceToBob.recv),
          mode: "nopin",
        }),
      ]);

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const envelope = await alice.encrypt(encoder.encode(message));
      const forwardPlaintext = decoder.decode(await bob.decrypt(envelope));

      snapshot = await alice.serialize();
      restoredAlice = await restoreSession(snapshot);
      await alice.destroy();
      alice = undefined;

      const reverseEnvelope = await bob.encrypt(
        encoder.encode("ratchet survived serialize() → restoreSession()"),
      );
      const reversePlaintext = decoder.decode(
        await restoredAlice.decrypt(reverseEnvelope),
      );

      setResult({
        protocolVersion: envelope.protocolVersion,
        forwardPlaintext,
        reversePlaintext,
        frameCount: envelope.frames.length,
        frameBytes: envelope.frames.reduce(
          (total, frame) => total + frame.byteLength,
          0,
        ),
        snapshotBytes: snapshot.byteLength,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Session demo failed");
    } finally {
      aliceIdentity?.ed25519SecretKey.fill(0);
      aliceIdentity?.x25519SecretKey.fill(0);
      bobIdentity?.ed25519SecretKey.fill(0);
      bobIdentity?.x25519SecretKey.fill(0);
      snapshot?.fill(0);
      await Promise.allSettled([
        alice?.destroy(),
        bob?.destroy(),
        restoredAlice?.destroy(),
      ]);
      setIsRunning(false);
    }
  };

  return (
    <main className='relative isolate min-h-screen overflow-hidden bg-white px-5 py-10 text-zinc-950 sm:px-8 dark:bg-black dark:text-white'>
      <div
        className='pointer-events-none absolute inset-0 text-orange-500 opacity-[0.08] dark:opacity-[0.05]'
        style={{
          backgroundImage:
            "radial-gradient(currentColor 1px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />
      <div className='relative mx-auto max-w-5xl'>
        <Link
          href='/'
          className='font-mono text-sm text-orange-700 underline decoration-dotted underline-offset-4 dark:text-orange-300'
        >
          ← p2party.com
        </Link>

        <div className='mt-6 border-2 border-zinc-950 bg-zinc-50 p-5 shadow-[8px_8px_0_0_#eb5e28] sm:p-8 dark:border-zinc-200 dark:bg-zinc-950'>
          <p className='font-mono text-xs font-bold tracking-[0.2em] text-orange-700 uppercase dark:text-orange-300'>
            protocol-v3 / standalone lab
          </p>
          <h1 className='mt-3 text-3xl font-black tracking-tight sm:text-5xl'>
            Bring your own transport.
          </h1>
          <p className='mt-4 max-w-3xl leading-relaxed text-zinc-600 dark:text-zinc-300'>
            This runs two <code>createSession()</code> peers in this tab,
            encrypts a message, serializes one Double Ratchet, restores it, and
            proves the reverse direction still decrypts.
          </p>
          <div className='mt-4 rounded-lg border border-amber-400 bg-amber-50 p-3 font-mono text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'>
            Honest boundary: this is an in-process byte-pipe demo. It does not
            discover peers, open WebRTC, hide metadata, or send anything to
            another device. <code>createSession()</code> supplies crypto; your
            application supplies transport and identity verification.
          </div>

          <label
            htmlFor='session-message'
            className='mt-7 block font-mono text-sm font-bold'
          >
            plaintext
          </label>
          <textarea
            id='session-message'
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            className='mt-2 block w-full resize-y rounded-none border-2 border-zinc-900 bg-white p-3 font-mono text-sm outline-none focus:border-orange-500 dark:border-zinc-300 dark:bg-black'
          />
          <Button
            color='orange'
            onClick={runDemo}
            disabled={isRunning}
            className='mt-4 rounded-none font-mono shadow-[4px_4px_0_0_rgba(0,0,0,0.25)]'
          >
            {isRunning ? "handshaking…" : "run local crypto proof"}
          </Button>

          {error && (
            <p
              role='alert'
              className='mt-5 border-2 border-red-700 bg-red-50 p-3 font-mono text-sm text-red-800 dark:bg-red-950 dark:text-red-200'
            >
              FAILED: {error}
            </p>
          )}

          {result && (
            <section
              aria-live='polite'
              className='mt-6 border-2 border-emerald-700 bg-emerald-50 p-4 font-mono text-sm dark:bg-emerald-950/30'
            >
              <p className='font-black text-emerald-800 dark:text-emerald-300'>
                OK — protocol {result.protocolVersion}
              </p>
              <dl className='mt-3 grid gap-2 sm:grid-cols-[12rem_1fr]'>
                <dt>alice → bob</dt>
                <dd className='break-words'>{result.forwardPlaintext}</dd>
                <dt>bob → restored alice</dt>
                <dd className='break-words'>{result.reversePlaintext}</dd>
                <dt>uniform frames</dt>
                <dd>
                  {result.frameCount} / {result.frameBytes.toLocaleString()}{" "}
                  bytes
                </dd>
                <dt>plaintext snapshot</dt>
                <dd>{result.snapshotBytes.toLocaleString()} bytes, wiped</dd>
              </dl>
            </section>
          )}
        </div>

        <pre className='mt-10 overflow-x-auto border border-zinc-700 bg-zinc-950 p-5 text-xs leading-relaxed text-orange-200 shadow-[6px_6px_0_0_rgba(235,94,40,0.45)]'>
          <code>{`import {
  createSession,
  generateSessionIdentity,
  restoreSession
} from "p2party/session";

// Your socket, WebRTC channel, native stream, or other byte transport:
const session = await createSession({ transport, identity, ...binding });
const envelope = await session.encrypt(plaintext);
const snapshot = await session.serialize(); // secret: encrypt at rest
const restored = await restoreSession(snapshot);`}</code>
        </pre>
      </div>
    </main>
  );
};

export default SessionLabPage;
