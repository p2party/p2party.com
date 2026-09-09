# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Email **security@p2party.com** with:

- the affected commit or deployed URL;
- a minimal reproduction;
- expected and observed behavior;
- impact and any known exploitation;
- whether you have shared the report elsewhere.

Do not include real room PINs, identity secrets, user messages, production
database exports, or credentials. Use synthetic data and a disposable local
signaling service.

We will acknowledge a report as soon as practical, coordinate validation and
remediation, and discuss disclosure timing with the reporter. Please allow a
reasonable remediation window before publication.

## Supported versions

Security fixes target the current production branch and current protocol
version. Protocol v4 does not negotiate a fallback to legacy crypto. Older
builds should be upgraded rather than treated as supported compatibility
targets.

## Current boundary

p2party is research-stage software and has not completed an independent
security audit. WebRTC peers can learn network metadata inherent to direct
connectivity. The signaling service sees room membership and timing when peers
join through legacy signaling; invitation fragments do not hide that admission
from the signaling operator.

Immediate delivery and policy-bound scheduled cover are implemented. Scheduled
cover has been measured over loopback; it is not a proof of resistance to
traffic analysis on real networks. Private rendezvous, anonymous admission, and
Sybil resistance are not deployed guarantees.

Identity keys and retained transfers live in browser storage. A compromised
browser, extension, or application origin can access them. Recovery phrases
are shown locally and must never appear in logs or reports. Peer messages are
rendered as text, and executable attachments are downloaded instead of opened
as documents on the application's origin.
