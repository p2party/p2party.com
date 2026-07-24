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
version. Protocol v3 does not negotiate a fallback to legacy crypto. Older
builds should be upgraded rather than treated as supported compatibility
targets.

## Current boundary

p2party is research-stage software and has not completed an independent
security audit. WebRTC peers can learn network metadata inherent to direct
connectivity. The signaling service sees current legacy meeting-point traffic.
Immediate delivery is the only shipped cover policy; scheduled cover and
private rendezvous descriptors are not deployed guarantees.
