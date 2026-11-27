import { expect, test } from "bun:test";
import type { Message, Room } from "p2party";
import {
  authenticatedSenderRoute,
  isLocalMessage,
} from "../src/protocol/messageIdentity";

test("a reused routing ID cannot reattribute message history", () => {
  const message = {
    fromPeerId: "reused",
    fromPeerPublicKey: "alice",
  } as Message;
  expect(isLocalMessage(message, "bob")).toBe(false);
  expect(isLocalMessage(message, "alice")).toBe(true);
  expect(isLocalMessage({ fromPeerId: "reused" } as Message, "bob")).toBe(
    false,
  );
  expect(
    isLocalMessage({ transferId: "local-transfer" } as Message, "bob"),
  ).toBe(true);
});

test("verification uses the current session authenticated to the recorded key", () => {
  const room = {
    peers: [
      { peerId: "old", peerPublicKey: "bob" },
      { peerId: "announced", peerPublicKey: "alice" },
      { peerId: "new", peerPublicKey: "alice" },
    ],
    handshakeStatusByPeer: {
      old: { status: "authenticated", peerPublicKey: "bob" },
      announced: { status: "authenticated", peerPublicKey: "other" },
      new: { status: "authenticated", peerPublicKey: "alice" },
    },
  } as unknown as Room;
  expect(authenticatedSenderRoute([room], "alice")).toBe("new");
  expect(authenticatedSenderRoute([room], "absent")).toBeUndefined();
});
