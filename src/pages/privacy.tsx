import { Link } from "../components/link";

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className='mt-10 mb-4 text-xl font-bold text-zinc-900 dark:text-white'>
    {children}
  </h2>
);

const Para = ({ children }: { children: React.ReactNode }) => (
  <p className='mb-4 text-base/7 text-zinc-600 dark:text-zinc-300'>
    {children}
  </p>
);

const Ul = ({ children }: { children: React.ReactNode }) => (
  <ul className='mb-4 list-disc space-y-1.5 pl-6 text-base/7 text-zinc-600 dark:text-zinc-300'>
    {children}
  </ul>
);

const PrivacyPage = () => {
  return (
    <main className='site-legal'>
      <article className='site-paper'>
        <h1 className='site-title mb-2'>Privacy Policy</h1>
        <p className='mb-8 text-sm text-zinc-400 dark:text-zinc-500'>
          Effective date: 17 October 2024 &middot; Last updated: 27 November
          2026
        </p>

        {/* 1 */}
        <SectionHeading>1. Introduction</SectionHeading>
        <Para>
          This Privacy Policy explains how the operator of p2party
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) handles
          information when you use the p2party platform (the
          &ldquo;Service&rdquo;) to create peer-to-peer (P2P) mesh networks for
          real-time text and file communication. We are committed to protecting
          your privacy and complying with the General Data Protection Regulation
          (EU) 2016/679 (&ldquo;GDPR&rdquo;), the ePrivacy Directive 2002/58/EC,
          and all other applicable European Union data-protection legislation.
        </Para>
        <Para>
          By using the Service you acknowledge that you have read and understood
          this policy. If you do not agree, please discontinue use of the
          Service.
        </Para>

        {/* 2 */}
        <SectionHeading>2. Data Controller</SectionHeading>
        <Para>
          The data controller for the purposes of the GDPR is the operator of
          p2party. You may reach us at{" "}
          <Link
            href='mailto:privacy@p2party.com'
            className='text-orange-600 underline dark:text-orange-400'
          >
            privacy@p2party.com
          </Link>
          .
        </Para>

        {/* 3 */}
        <SectionHeading>3. What Data We Process</SectionHeading>
        <Para>
          p2party is designed to minimise the data we handle. We do <em>not</em>{" "}
          require accounts, email addresses, or any personally identifiable
          registration information. The categories below describe the limited
          data that our infrastructure touches:
        </Para>

        <h3 className='mt-6 mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100'>
          3.1 Signaling Server
        </h3>
        <Para>
          Our WebSocket-based signaling server introduces peers to one another.
          WebRTC Session Description Protocol (SDP) offers, answers, and ICE
          candidates are forwarded between two connected peers and are not
          written to the database, except as the short-lived cross-process
          routing rows described below.
        </Para>
        <Para>
          The server keeps a PostgreSQL database on the same EU infrastructure
          for stable identity and room membership. The supported deployment uses
          one signaling process; an experimental cross-process routing path uses
          the same database. It holds:
        </Para>
        <Ul>
          <li>
            <strong>One row per identity:</strong> your client&rsquo;s Ed25519
            public key, the time it was first seen and last seen, and which
            server process currently holds its socket. That last field is
            cleared when you disconnect; the row itself remains, and
            reconnecting with the same key reuses it. New identity rows are
            created only after the client proves possession of the key.
          </li>
          <li>
            <strong>One row per room:</strong> the room identifier and the
            identities that belong to it. With signaling v5, your browser
            computes the identifier by hashing the invitation capability with
            SHA-512. It sends that identifier whenever you join or leave. An
            acknowledged room leave removes that membership. Closing the tab can
            leave you listed. The server also expires inactive identities and
            their memberships as described in section 7.
          </li>
          <li>
            <strong>Short-lived routing rows:</strong> a signal addressed to a
            peer whose socket is held by another server process. The receiving
            process deletes the row as soon as it has delivered the signal.
          </li>
        </Ul>
        <Para>
          The server sends a ping every 10 seconds and closes a socket that has
          not answered within 5 seconds. Other online members can receive a
          notification when you leave or when your last signaling socket closes.
          These notifications reveal the timing of your presence.
        </Para>
        <Para>
          What this means in practice: the operator of the signaling service can
          see which identity keys are in which room, and when they connect and
          disconnect. It cannot see the content of anything you send. Room
          membership and timing are not hidden from it, and we do not claim
          otherwise. Blind rendezvous, private invitation retrieval, proof of
          work and optional passkeys remain separate local research experiments;
          they are not modes in the deployed room flow.
        </Para>

        <h3 className='mt-6 mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100'>
          3.2 STUN Server
        </h3>
        <Para>
          The STUN (Session Traversal Utilities for NAT) server reflects your
          public IP address back to your browser so that direct peer connections
          can be established. STUN is a stateless protocol, so the server holds
          no session state; as a deployment commitment, we configure it to keep
          no logs.
        </Para>

        <h3 className='mt-6 mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100'>
          3.3 TURN Relay
        </h3>
        <Para>
          When two peers cannot establish a direct connection (e.g., both are
          behind symmetric NATs), data may be relayed through our TURN
          (Traversal Using Relays around NAT) server. Relayed traffic is
          encrypted twice over — by WebRTC&rsquo;s own DTLS transport, and
          inside that by p2party&rsquo;s per-message keys — so the relay cannot
          read it. As a deployment commitment rather than a property of the
          protocol, we configure the relay to keep no traffic logs and to retain
          no traffic data after the session ends.
        </Para>
        <Para>
          A relay is a transport, not a privacy proxy. While an allocation is
          open, the relay necessarily handles your IP address, the times you
          connect, and the volume of bytes passing through. In signaling v5 the
          relay username contains an expiry time and an opaque tag. The relay
          can link allocations that use the same tag until it rotates.
        </Para>

        <h3 className='mt-6 mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100'>
          3.4 Communication Content
        </h3>
        <Para>
          Text messages and files are transmitted directly between peers over
          WebRTC data channels. Before either side can send anything, the two
          browsers run a handshake that combines an interactive Diffie-Hellman
          exchange over X25519 with a post-quantum ML-KEM exchange, and mixes
          both into one key. Each side&rsquo;s Ed25519 identity key cross-signs
          its own X25519 key, which is what lets you pin who you are talking to;
          the handshake itself is authenticated by three chained
          key-confirmation flights computed over the mixed key. Identity keys
          are never used to encrypt. After the handshake, every message is
          sealed with ChaCha20-Poly1305 under its own key from a per-peer Double
          Ratchet, and split into fixed-size 65,490-byte cells that are padded
          to full whatever the payload was. Our servers never see, store, or
          have the ability to decrypt the content of your communications.
        </Para>

        <h3 className='mt-6 mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100'>
          3.5 Local Browser Storage
        </h3>
        <Para>
          The Service uses your browser&rsquo;s IndexedDB &mdash; and, where
          your browser supports it, the Origin Private File System for large
          received files &mdash; to hold your long-term identity keys, your
          saved rooms and their invite links, your address book and blacklist,
          the ratchet state for each peer you have talked to, and your message
          history, received file data and prepared pending sends. This data
          stays on your device. It is never uploaded, and you can clear it at
          any time through your browser settings.
        </Para>
        <Para>
          An identity created from a recovery phrase can be restored in another
          browser from those 24 words, together with the password you chose for
          them if you set one. That phrase is derived one way into the key and
          is shown at creation and is not retained by the app. The identity key
          remains in browser storage; a compromised browser, extension or
          application origin can access it. An identity created without a phrase
          has no such route: if you clear site data, use a different browser
          profile, or lose the device, that identity and everything stored under
          it is gone, and nobody &mdash; including us &mdash; can recover it.
        </Para>

        <h3 className='mt-6 mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100'>
          3.6 Cookies &amp; Tracking
        </h3>
        <Para>
          We do not use cookies, web beacons, pixels, fingerprinting, or any
          third-party tracking or analytics services. We do not serve
          advertisements.
        </Para>

        {/* 4 */}
        <SectionHeading>
          4. Legal Basis for Processing (Art. 6 GDPR)
        </SectionHeading>
        <Para>
          Where we process personal data (IP addresses during STUN/TURN
          sessions, and the identity public keys and room membership held by the
          signaling server), the legal basis is:
        </Para>
        <Ul>
          <li>
            <strong>Art. 6(1)(b) — Performance of a contract:</strong>{" "}
            processing is necessary to provide the Service you requested
            (establishing peer-to-peer connections).
          </li>
          <li>
            <strong>Art. 6(1)(f) — Legitimate interest:</strong> short-lived
            processing of connection data to maintain the security and
            availability of the Service, provided this does not override your
            fundamental rights and freedoms.
          </li>
        </Ul>

        {/* 5 */}
        <SectionHeading>5. Data Sharing &amp; Disclosure</SectionHeading>
        <Ul>
          <li>
            We do <strong>not</strong> sell, rent, or trade personal data.
          </li>
          <li>
            We do <strong>not</strong> share data with third-party advertisers
            or analytics providers.
          </li>
          <li>
            We may disclose data only if required by a binding legal obligation
            under EU or member-state law (e.g., court order, law-enforcement
            request). We hold no communication content at all, so it cannot be
            disclosed. What the signaling database does hold, and therefore what
            such a request could reach, is described in section 3.1: identity
            public keys, first-seen and last-seen times, and which identities
            are members of which room hash.
          </li>
        </Ul>

        {/* 6 */}
        <SectionHeading>6. International Data Transfers</SectionHeading>
        <Para>
          Hetzner Online GmbH hosts the signaling, STUN and TURN services in the
          European Union. The website uses Cloudflare for delivery and Amazon S3
          for static files. Cloudflare processes website requests, including
          connection addresses, at its edge. The location of the signaling
          database does not establish where a website request was processed.
        </Para>

        {/* 7 */}
        <SectionHeading>7. Data Retention</SectionHeading>
        <Ul>
          <li>
            <strong>Signaling traffic (SDP, ICE candidates):</strong> forwarded
            between peers and not written to the database, except as the
            short-lived cross-process routing rows, which are deleted as soon as
            the signal is delivered.
          </li>
          <li>
            <strong>Signaling database rows:</strong> the identity row and the
            room-hash membership described in section 3.1 outlive a disconnect.
            An acknowledged leave removes that room membership. The public
            server expires offline identities and their memberships after 90
            days without authentication. When the identity table is full,
            eligible offline identities can be reclaimed sooner, with a
            ten-minute reconnect window. You can authenticate again with the
            same key and rejoin using the invitation. Empty rooms become
            eligible for cleanup after 24 hours without an update.
          </li>
          <li>
            <strong>Optional public testnet:</strong> if you submit a native
            transfer to P2Party Testnet 1, its signed transfer and receipt
            become part of the public ledger history. Anyone can read and copy
            those records. Leaving a room or purging a device has no effect on
            that history. Chatting and exchanging files do not require a wallet.
          </li>
          <li>
            <strong>STUN data:</strong> not stored at all (stateless protocol).
          </li>
          <li>
            <strong>TURN relay data:</strong> processed in real-time only;
            destroyed when the relay allocation expires.
          </li>
          <li>
            <strong>Communication content:</strong> the signaling server never
            receives messages or files. A TURN relay can carry their encrypted
            bytes when direct connectivity fails; it cannot decrypt them.
          </li>
          <li>
            <strong>Browser-local data:</strong> identities, saved rooms,
            received content and contacts persist until you delete them or clear
            site data. Prepared pending sends expire after 24 hours and are no
            longer retryable. Expired records are cleaned when the app runs its
            cleanup; this is not a promise of disk deletion while the site is
            closed. Cancellation and completion also remove pending sends.
            Browser storage can be evicted by the browser or operating system.
          </li>
        </Ul>

        {/* 8 */}
        <SectionHeading>8. Your Rights Under the GDPR</SectionHeading>
        <Para>Under the GDPR you have the right to:</Para>
        <Ul>
          <li>
            <strong>Access</strong> (Art. 15) — request confirmation of whether
            we process your personal data and, if so, access a copy.
          </li>
          <li>
            <strong>Rectification</strong> (Art. 16) — request correction of
            inaccurate personal data.
          </li>
          <li>
            <strong>Erasure</strong> (Art. 17) — request deletion of personal
            data (&ldquo;right to be forgotten&rdquo;).
          </li>
          <li>
            <strong>Restriction of processing</strong> (Art. 18) — request that
            we limit how we use your data.
          </li>
          <li>
            <strong>Data portability</strong> (Art. 20) — receive your data in a
            structured, machine-readable format.
          </li>
          <li>
            <strong>Object</strong> (Art. 21) — object to processing based on
            legitimate interests.
          </li>
          <li>
            <strong>Lodge a complaint</strong> — with your local EU supervisory
            authority if you believe your rights have been infringed.
          </li>
        </Ul>
        <Para>
          Identity public keys and room membership persist as described above;
          they are not merely ephemeral session data. If you wish to exercise
          any right, please contact us at{" "}
          <Link
            href='mailto:privacy@p2party.com'
            className='text-orange-600 underline dark:text-orange-400'
          >
            privacy@p2party.com
          </Link>
          .
        </Para>

        {/* 9 */}
        <SectionHeading>9. Data Security</SectionHeading>
        <Para>We employ the following security measures:</Para>
        <Ul>
          <li>
            End-to-end encryption of all user communications with
            ChaCha20-Poly1305, under per-message keys from a per-peer Double
            Ratchet, established by a handshake that mixes X25519 and ML-KEM,
            with each side&rsquo;s X25519 key cross-signed by its Ed25519
            identity and the handshake confirmed by three chained
            key-confirmation flights.
          </li>
          <li>
            Every message is split into fixed 65,490-byte cells, with the real
            bytes at a random offset and the rest filled with random padding, so
            the size of a cell tells an observer nothing about the size of what
            is inside it.
          </li>
          <li>
            A deployment commitment, not a protocol property: we configure our
            signaling and TURN servers to accept only TLS-protected connections.
            STUN itself is a stateless UDP protocol and is not encrypted; it
            reflects your public address back to you and carries nothing else.
          </li>
          <li>
            Servers never see decrypted content. The signaling database holds
            only what section 3.1 lists.
          </li>
          <li>
            The signaling and relay hosts run on Hetzner in the EU. Static web
            content is delivered through Cloudflare.
          </li>
        </Ul>
        <Para>
          What these measures do <em>not</em> do is equally worth stating.
          Uniform cells hide the length of a message; they do not hide that
          cells were sent, how many, or when. A room can be created with a
          scheduled cover policy, in which every peer emits cells on a fixed
          rhythm whether or not it has anything to send &mdash; that is timing
          cover, and we have measured it over a loopback connection only. We do
          not claim resistance to traffic analysis, and we will not until there
          is a published measurement to point at. The protocol has also not had
          an independent third-party security audit.
        </Para>

        {/* 10 */}
        <SectionHeading>10. Children&rsquo;s Privacy</SectionHeading>
        <Para>
          The Service is not directed at children under the age of 16. We do not
          knowingly collect personal data from children. If you believe a child
          has provided personal data through the Service, please contact us and
          we will take steps to delete it.
        </Para>

        {/* 11 */}
        <SectionHeading>
          11. Data Protection Impact Assessment (DPIA)
        </SectionHeading>
        <Para>
          In accordance with Article 35 of the GDPR, we have conducted a Data
          Protection Impact Assessment for the Service. The assessment concluded
          that the processing carried out by p2party presents a low risk to the
          rights and freedoms of data subjects because:
        </Para>
        <Ul>
          <li>
            The signaling server processes only the data required to establish
            peer-to-peer connections: identity public keys, the hash of a room
            capability, and WebRTC signaling metadata.
          </li>
          <li>
            All user-generated content (messages, files) is end-to-end encrypted
            with ChaCha20-Poly1305 and travels directly between browsers. Our
            signaling server never carries it; a TURN relay carries it only when
            a direct connection is impossible, and cannot read it.
          </li>
          <li>
            Peer identities are pseudonymous. They are cryptographic public
            keys, not names, and we ask for nothing that ties one to a person.
            They are not, however, per-session throwaways: the same browser
            profile presents the same identity key every time, and the signaling
            database recognises it as the same peer.
          </li>
          <li>
            As a deployment commitment rather than a property of the published
            source: we configure our servers so that logs are IP-anonymised
            (last octet masked) and retained for no more than 30 days.
          </li>
          <li>
            Signaling and relay infrastructure is hosted in the European Union.
            Website delivery is described in section 6.
          </li>
        </Ul>
        <Para>
          A copy of the full DPIA is available upon request by contacting{" "}
          <Link
            href='mailto:privacy@p2party.com'
            className='text-orange-600 underline dark:text-orange-400'
          >
            privacy@p2party.com
          </Link>
          .
        </Para>

        {/* 12 */}
        <SectionHeading>12. Changes to This Policy</SectionHeading>
        <Para>
          We may update this Privacy Policy from time to time. Material changes
          will be communicated by updating the &ldquo;Last updated&rdquo; date
          at the top of this page. We encourage you to review this page
          periodically. Continued use of the Service after changes constitutes
          acceptance of the updated policy.
        </Para>

        {/* 13 */}
        <SectionHeading>13. Contact Us</SectionHeading>
        <Para>
          If you have questions, concerns, or requests regarding this Privacy
          Policy or your personal data, please contact us at:
        </Para>
        <Para>
          the operator of p2party
          <br />
          Email:{" "}
          <Link
            href='mailto:privacy@p2party.com'
            className='text-orange-600 underline dark:text-orange-400'
          >
            privacy@p2party.com
          </Link>
        </Para>

        {/* Back link */}
        <div className='mt-12 mb-8'>
          <Link
            href='/'
            className='text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300'
          >
            &larr; Back to p2party
          </Link>
        </div>
      </article>
    </main>
  );
};

export default PrivacyPage;
