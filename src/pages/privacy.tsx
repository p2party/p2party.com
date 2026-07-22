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
    <div className='flex min-h-screen w-full justify-center bg-white px-6 py-16 dark:bg-black'>
      <article className='w-full max-w-3xl'>
        <h1 className='mb-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-white'>
          Privacy Policy
        </h1>
        <p className='mb-8 text-sm text-zinc-400 dark:text-zinc-500'>
          Effective date: 17 October 2024 &middot; Last updated: 25 February
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
            href='mailto:[contact email]'
            className='text-orange-600 underline dark:text-orange-400'
          >
            [contact email]
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
          Our WebSocket-based signaling server processes ephemeral session
          identifiers and WebRTC Session Description Protocol (SDP) offers and
          answers solely to introduce peers to one another. This data is held in
          memory only for the lifetime of the WebSocket connection and is
          automatically discarded when the connection closes. It is never
          written to disk.
        </Para>

        <h3 className='mt-6 mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100'>
          3.2 STUN Server
        </h3>
        <Para>
          The STUN (Session Traversal Utilities for NAT) server reflects your
          public IP address back to your browser so that direct peer connections
          can be established. STUN is a stateless protocol — the server keeps no
          logs and stores no data.
        </Para>

        <h3 className='mt-6 mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100'>
          3.3 TURN Relay
        </h3>
        <Para>
          When two peers cannot establish a direct connection (e.g., both are
          behind symmetric NATs), data may be relayed through our TURN
          (Traversal Using Relays around NAT) server. The relay processes IP
          addresses and encrypted data packets in real time. All relayed traffic
          is end-to-end encrypted with ChaChaPoly1305 — the relay cannot decrypt
          it. No logs are retained and no traffic data is stored after the
          session ends.
        </Para>

        <h3 className='mt-6 mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100'>
          3.4 Communication Content
        </h3>
        <Para>
          Text messages and files are transmitted directly between peers via
          WebRTC data channels. They are encrypted end-to-end using
          ChaChaPoly1305 AEAD with ephemeral Ed25519 keys and are further
          protected by our offensive-cryptography chunking scheme. Our servers
          never see, store, or have the ability to decrypt the content of your
          communications.
        </Para>

        <h3 className='mt-6 mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100'>
          3.5 Local Browser Storage
        </h3>
        <Para>
          The Service may use your browser&rsquo;s IndexedDB to persist room
          keys or local preferences on your device only. This data never leaves
          your browser and can be cleared at any time via your browser settings.
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
          sessions, ephemeral session identifiers on the signaling server), the
          legal basis is:
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
            request). Because we do not store communication content or
            persistent connection logs, any such disclosure would be extremely
            limited.
          </li>
        </Ul>

        {/* 6 */}
        <SectionHeading>6. International Data Transfers</SectionHeading>
        <Para>
          All servers — signaling, STUN, and TURN — are hosted on{" "}
          <strong>Hetzner Online GmbH</strong> infrastructure located in the{" "}
          <strong>European Union</strong>. We do not transfer personal data
          outside the EU/EEA. Should this change in the future, we will ensure
          appropriate safeguards (such as Standard Contractual Clauses) are in
          place in accordance with Chapter V of the GDPR before any transfer
          occurs.
        </Para>

        {/* 7 */}
        <SectionHeading>7. Data Retention</SectionHeading>
        <Ul>
          <li>
            <strong>Signaling data:</strong> retained in volatile memory only
            for the duration of the WebSocket session; destroyed on disconnect.
          </li>
          <li>
            <strong>STUN data:</strong> not stored at all (stateless protocol).
          </li>
          <li>
            <strong>TURN relay data:</strong> processed in real-time only;
            destroyed when the relay allocation expires.
          </li>
          <li>
            <strong>Communication content:</strong> never reaches our servers.
          </li>
          <li>
            <strong>Browser-local data (IndexedDB):</strong> persists on your
            device until you clear it.
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
          Because we do not store personally identifiable information beyond
          ephemeral session data, most of these rights are satisfied by design.
          If you wish to exercise any right, please contact us at{" "}
          <Link
            href='mailto:[contact email]'
            className='text-orange-600 underline dark:text-orange-400'
          >
            [contact email]
          </Link>
          .
        </Para>

        {/* 9 */}
        <SectionHeading>9. Data Security</SectionHeading>
        <Para>We employ the following security measures:</Para>
        <Ul>
          <li>
            End-to-end encryption of all user communications using
            ChaChaPoly1305 AEAD with ephemeral Ed25519 keys.
          </li>
          <li>
            Offensive-cryptography chunking that pads every message with
            cryptographic random noise, making traffic analysis impractical.
          </li>
          <li>
            TLS encryption for all connections to the signaling, STUN, and TURN
            servers.
          </li>
          <li>
            Minimal-data architecture — servers never see decrypted content and
            do not persist connection metadata.
          </li>
          <li>
            Infrastructure hosted on Hetzner (EU) with hardened server
            configurations.
          </li>
        </Ul>

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
            The signaling server processes only the minimum data required to
            establish peer-to-peer connections (ephemeral public keys, room
            identifiers, and WebRTC signaling metadata).
          </li>
          <li>
            All user-generated content (messages, files) is end-to-end encrypted
            with ChaChaPoly1305 and never passes through our servers.
          </li>
          <li>
            Peer identities are pseudonymous (randomly generated UUIDs) and are
            not linked to any real-world identity.
          </li>
          <li>
            Server logs are IP-anonymised (last octet masked) and retained for
            no more than 30 days.
          </li>
          <li>
            All infrastructure is located exclusively within the European Union
            (Hetzner, Nuremberg, Germany).
          </li>
        </Ul>
        <Para>
          A copy of the full DPIA is available upon request by contacting{" "}
          <Link
            href='mailto:[contact email]'
            className='text-orange-600 underline dark:text-orange-400'
          >
            [contact email]
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
            href='mailto:[contact email]'
            className='text-orange-600 underline dark:text-orange-400'
          >
            [contact email]
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
    </div>
  );
};

export default PrivacyPage;
