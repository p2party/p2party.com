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

const TOSPage = () => {
  return (
    <div className='flex min-h-screen w-full justify-center bg-white px-6 py-16 dark:bg-black'>
      <article className='w-full max-w-3xl'>
        <h1 className='mb-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-white'>
          Terms of Service
        </h1>
        <p className='mb-8 text-sm text-zinc-400 dark:text-zinc-500'>
          Effective date: 17 October 2024 &middot; Last updated: 25 February
          2026
        </p>

        {/* 1 */}
        <SectionHeading>1. Agreement to Terms</SectionHeading>
        <Para>
          These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally
          binding agreement between you (&ldquo;User&rdquo;, &ldquo;you&rdquo;)
          and the operator of p2party (&ldquo;we&rdquo;, &ldquo;us&rdquo;,
          &ldquo;our&rdquo;) governing your access to and use of the p2party
          platform and any associated services (collectively, the
          &ldquo;Service&rdquo;). By accessing or using the Service you agree to
          be bound by these Terms. If you do not agree, you must stop using the
          Service immediately.
        </Para>

        {/* 2 */}
        <SectionHeading>2. Description of the Service</SectionHeading>
        <Para>
          p2party provides a browser-based, peer-to-peer (P2P) communication
          platform that enables real-time text messaging and file sharing over
          WebRTC data channels. Peers discover each other through a lightweight
          signaling server; NAT traversal is assisted by STUN and TURN servers.
          All servers are hosted in the European Union on Hetzner Online GmbH
          infrastructure.
        </Para>
        <Para>
          The Service does not require user registration, accounts, email
          addresses, or any personal identification. Communication content is
          end-to-end encrypted and never stored by or accessible to our servers.
        </Para>

        {/* 3 */}
        <SectionHeading>3. Eligibility</SectionHeading>
        <Para>
          You must be at least 16 years of age to use the Service. By using the
          Service you represent and warrant that you meet this age requirement
          and have the legal capacity to enter into these Terms.
        </Para>

        {/* 4 */}
        <SectionHeading>
          4. User Responsibilities &amp; Acceptable Use
        </SectionHeading>
        <Para>
          You agree that you will <strong>not</strong> use the Service to:
        </Para>
        <Ul>
          <li>
            Transmit any content that is unlawful, threatening, abusive,
            harassing, defamatory, obscene, hateful, discriminatory, or
            otherwise objectionable under applicable law.
          </li>
          <li>
            Distribute malware, viruses, or any code designed to disrupt,
            damage, or limit the functionality of any software or hardware.
          </li>
          <li>
            Engage in, facilitate, or promote illegal activities including,
            without limitation, fraud, terrorism, trafficking, or the
            distribution of child sexual abuse material.
          </li>
          <li>
            Infringe or violate the intellectual-property rights, privacy
            rights, or other rights of any third party.
          </li>
          <li>
            Attempt to probe, scan, or test the vulnerability of the Service or
            circumvent any security measures.
          </li>
          <li>
            Interfere with, overload, or impair the normal operation of the
            Service or any associated network.
          </li>
        </Ul>
        <Para>
          You are solely responsible for all content you transmit through the
          Service. Because communications are end-to-end encrypted we cannot
          monitor or moderate content in transit; however, we reserve the right
          to take action — including suspension of access — if we become aware
          of a violation of these Terms.
        </Para>

        {/* 5 */}
        <SectionHeading>5. Connection &amp; Server Data</SectionHeading>
        <Para>
          <strong>Signaling Server:</strong> processes ephemeral session
          identifiers and SDP offers/answers to facilitate peer discovery. Data
          is held in volatile memory for the duration of the connection and is
          not written to disk.
        </Para>
        <Para>
          <strong>STUN Server:</strong> reflects your public IP address back to
          your browser to assist with NAT traversal. STUN is stateless and keeps
          no logs.
        </Para>
        <Para>
          <strong>TURN Relay:</strong> relays end-to-end encrypted traffic when
          direct connections are not possible. No traffic payload is decrypted,
          logged, or stored.
        </Para>

        {/* 6 */}
        <SectionHeading>6. Open-Source Software</SectionHeading>
        <Para>
          Portions of the Service — including the{" "}
          <Link
            href='https://github.com/p2party/p2party-js'
            target='_blank'
            rel='noopener noreferrer'
            className='text-orange-600 underline dark:text-orange-400'
          >
            p2party-js client library
          </Link>{" "}
          and the{" "}
          <Link
            href='https://github.com/p2party'
            target='_blank'
            rel='noopener noreferrer'
            className='text-orange-600 underline dark:text-orange-400'
          >
            signaling server
          </Link>{" "}
          — are released under Apache-2.0. The p2party.com website source is
          released under AGPL-3.0-only. Your use of those components is
          additionally governed by the applicable open-source licence terms,
          which prevail in the event of any conflict with these Terms.
        </Para>

        {/* 7 */}
        <SectionHeading>7. Intellectual Property</SectionHeading>
        <Para>
          All proprietary content and technology relating to the Service —
          including trademarks, logos, the p2party name, visual design, and any
          non-open-source code — are and remain the property of the operator of
          p2party and are protected by applicable intellectual-property laws.
          Nothing in these Terms grants you any right, title, or interest in
          such proprietary materials except for the limited, revocable,
          non-transferable, non-exclusive right to use the Service in accordance
          with these Terms.
        </Para>

        {/* 8 */}
        <SectionHeading>8. Privacy</SectionHeading>
        <Para>
          Our collection and use of data is described in our{" "}
          <Link
            href='/privacy-policy'
            className='text-orange-600 underline dark:text-orange-400'
          >
            Privacy Policy
          </Link>
          , which forms part of these Terms. By using the Service you
          acknowledge that you have read and understood the Privacy Policy.
        </Para>

        {/* 9 */}
        <SectionHeading>9. Disclaimers</SectionHeading>
        <Para>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
          AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS,
          IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES
          OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
          NON-INFRINGEMENT.
        </Para>
        <Para>
          We do not warrant that the Service will be uninterrupted, timely,
          secure, or error-free, or that any defects will be corrected. Your use
          of the Service is at your sole risk.
        </Para>

        {/* 10 */}
        <SectionHeading>10. Limitation of Liability</SectionHeading>
        <Para>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL
          THE OPERATOR OF P2PARTY, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS,
          OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, USE,
          GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
        </Para>
        <Ul>
          <li>Your access to, use of, or inability to use the Service.</li>
          <li>
            Any conduct or content of any third party on or related to the
            Service, including without limitation any defamatory, offensive, or
            illegal conduct of other users.
          </li>
          <li>Any content obtained from the Service.</li>
          <li>
            Unauthorised access to, alteration of, or loss of your transmissions
            or data.
          </li>
        </Ul>
        <Para>
          Nothing in these Terms excludes or limits liability that cannot be
          excluded or limited under applicable EU or member-state law, including
          liability for death or personal injury caused by negligence, for fraud
          or fraudulent misrepresentation, or other liabilities that cannot be
          lawfully excluded.
        </Para>

        {/* 11 */}
        <SectionHeading>11. Indemnification</SectionHeading>
        <Para>
          You agree to defend, indemnify, and hold harmless the operator of
          p2party and its officers, directors, employees, and agents from and
          against any claims, liabilities, damages, losses, and expenses —
          including reasonable legal fees — arising out of or in any way
          connected with your access to or use of the Service, your violation of
          these Terms, or your violation of any rights of a third party.
        </Para>

        {/* 12 */}
        <SectionHeading>
          12. Service Modifications &amp; Availability
        </SectionHeading>
        <Para>
          We reserve the right to modify, suspend, or discontinue the Service
          (or any part thereof) at any time, with or without notice. We shall
          not be liable to you or any third party for any such modification,
          suspension, or discontinuation.
        </Para>

        {/* 13 */}
        <SectionHeading>13. Termination</SectionHeading>
        <Para>
          We may restrict or terminate your access to the Service at any time if
          we reasonably believe you have violated these Terms or applicable law.
          Due to the anonymous, account-free nature of the Service, termination
          may involve blocking connections from specific network addresses.
          Sections of these Terms that by their nature should survive
          termination shall survive, including but not limited to Sections 9,
          10, 11, 14, and 15.
        </Para>

        {/* 14 */}
        <SectionHeading>14. Governing Law &amp; Jurisdiction</SectionHeading>
        <Para>
          These Terms shall be governed by and construed in accordance with the
          laws of the European Union and the applicable laws of Greece, without
          regard to conflict-of-law principles. Any disputes arising out of or
          in connection with these Terms shall be submitted to the exclusive
          jurisdiction of the courts of Athens, Greece, unless mandatory EU
          consumer-protection rules provide otherwise.
        </Para>
        <Para>
          If you are a consumer habitually resident in the EU, you additionally
          enjoy the protection of mandatory provisions of the law of your
          country of residence. Nothing in these Terms affects your rights as a
          consumer to rely on such mandatory provisions.
        </Para>

        {/* 15 */}
        <SectionHeading>15. Dispute Resolution</SectionHeading>
        <Para>
          Before initiating formal legal proceedings, you agree to attempt to
          resolve any dispute informally by contacting us at{" "}
          <Link
            href='mailto:[contact email]'
            className='text-orange-600 underline dark:text-orange-400'
          >
            [contact email]
          </Link>
          . We will endeavour to resolve the matter within 30 days. If the
          dispute is not resolved informally, either party may proceed in
          accordance with Section 14.
        </Para>
        <Para>
          EU consumers may also use the{" "}
          <Link
            href='https://ec.europa.eu/consumers/odr'
            target='_blank'
            rel='noopener noreferrer'
            className='text-orange-600 underline dark:text-orange-400'
          >
            European Commission&rsquo;s Online Dispute Resolution platform
          </Link>
          .
        </Para>

        {/* 16 */}
        <SectionHeading>16. Severability</SectionHeading>
        <Para>
          If any provision of these Terms is held to be invalid, illegal, or
          unenforceable, the remaining provisions shall continue in full force
          and effect. The invalid provision shall be modified to the minimum
          extent necessary to make it valid and enforceable while preserving the
          original intent.
        </Para>

        {/* 17 */}
        <SectionHeading>17. Entire Agreement</SectionHeading>
        <Para>
          These Terms, together with the{" "}
          <Link
            href='/privacy-policy'
            className='text-orange-600 underline dark:text-orange-400'
          >
            Privacy Policy
          </Link>
          , constitute the entire agreement between you and the operator of
          p2party with respect to the Service and supersede all prior or
          contemporaneous understandings, agreements, and communications,
          whether written or oral.
        </Para>

        {/* 18 */}
        <SectionHeading>18. Changes to These Terms</SectionHeading>
        <Para>
          We reserve the right to modify these Terms at any time. Material
          changes will be indicated by updating the &ldquo;Last updated&rdquo;
          date at the top of this page. Continued use of the Service after
          changes are posted constitutes acceptance of the revised Terms. If you
          do not agree with any change, you must stop using the Service.
        </Para>

        {/* 19 */}
        <SectionHeading>19. Contact Us</SectionHeading>
        <Para>
          If you have questions or concerns about these Terms, please contact us
          at:
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

export default TOSPage;
