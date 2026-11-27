# Web client changelog

## November 27, 2026

- The public web client uses SDK 0.15.0 and signaling protocol 5. Room peers continue to encrypt with protocol 4. Self-hosters should upgrade signaling before updating clients.
- Contacts and blocks follow a proved identity key after a reconnect. Legacy history remains readable. A message without an authenticated key cannot be used to add or block a contact.
- Retained files can resume after sender reload. Interrupted cleanup can retry on restart. Local browser tests verified 16 MiB recovery and a 64 MiB interrupted send byte for byte.
- Two fresh Chromium pairs verified persisted text and a byte-exact 32 KiB disk-backed file through the public service. Browser statistics confirmed one direct ICE path and one forced TURN path.
- Android now targets API 37. Debug and unsigned release builds passed, alongside an Android 16 emulator check for keyboard and status bar behavior. Android 17 permission and physical-device validation are outstanding.
- The release article links to P2Party Testnet 1, a live single-validator experiment. All six public downloads matched the release assets. A fresh wallet installation checked both chain IDs and read the genesis head.

[Release article](src/content/blog/09-rooms-after-signaling-v5.md) · [SDK release](https://github.com/p2party/p2party-js/tree/v0.15.0) · [Native build record](docs/native-builds.md)

## September 9, 2026

SDK 0.14.10 and server 0.1.4 addressed peer reconnection and durable transfer recovery. [September release notes](src/content/blog/08-after-the-desync-fixes.md)
