// Run against the locally built site and a disposable signaling deployment.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";

const app = new URL(process.env.APP_URL);
const signaling = new URL(process.env.SIGNALING_URL);
for (const url of [app, signaling])
  assert(
    ["127.0.0.1", "localhost"].includes(url.hostname) &&
      Number(url.port) > 5000,
  );
const stun = process.env.STUN_URL;
if (stun) assert(/^stun:(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(stun));
const capability = randomBytes(32);
const invite = capability.toString("hex");
const roomUrl = new URL("/r#v1." + capability.toString("base64url"), app).href;
const size = 64 * 1024 * 1024;
const browser = await chromium.launch();
try {
  const departures = [];
  const [sender, receiver] = await Promise.all(
    [true, false].map(async (isSender) => {
      const ctx = await browser.newContext();
      await ctx.addInitScript(
        ({ url, isSender, stun }) => {
          localStorage.setItem("signalingServerUrl", JSON.stringify(url));
          localStorage.setItem(
            "stunServerUrls",
            JSON.stringify(stun ? [stun] : []),
          );
          if (!isSender || sessionStorage.getItem("resume")) return;
          let seen = 0;
          const send = RTCDataChannel.prototype.send;
          RTCDataChannel.prototype.send = function (data) {
            const bytes =
              data instanceof ArrayBuffer
                ? new Uint8Array(data)
                : ArrayBuffer.isView(data)
                  ? new Uint8Array(
                      data.buffer,
                      data.byteOffset,
                      data.byteLength,
                    )
                  : undefined;
            if (bytes?.length === 65490 && bytes[0] === 2 && ++seen > 8) return;
            return send.call(this, data);
          };
        },
        { url: signaling.href, isSender, stun },
      );
      const page = await ctx.newPage();
      if (!isSender)
        page.on("websocket", (ws) => {
          if (ws.url() !== signaling.href) return;
          ws.on("framereceived", ({ payload }) => {
            if (typeof payload !== "string") return;
            const frame = JSON.parse(payload);
            if (frame.type === "peerLeft") departures.push(frame);
          });
        });
      await page.goto(roomUrl);
      await page.getByRole("button", { name: "Connect", exact: true }).click();
      return page;
    }),
  );
  const ready = (cap) => {
    const p = window.p2party;
    const room = p?.roomSelector(p.store.getState()).find((r) => r.url === cap);
    return (
      room &&
      Object.values(room.handshakeStatusByPeer ?? {}).some(
        (s) => s.status === "authenticated",
      ) &&
      room.id
    );
  };
  for (const page of [sender, receiver])
    await page.waitForFunction(ready, invite, { timeout: 90000 });
  const roomId = await sender.evaluate(ready, invite);
  const senderKey = await sender.evaluate(() => {
    const { publicKey, peerId } = window.p2party.keyPairSelector(
      window.p2party.store.getState(),
    );
    return { publicKey, peerId };
  });
  await sender.evaluate(
    ({ roomId, size }) => {
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) data[i] = (29 * i + (i >>> 16)) & 255;
      const file = new File([data], "release-transfer.bin", {
        type: "application/octet-stream",
      });
      window.p2party.sendMessage(file, "main", roomId).done.catch(() => {});
    },
    { roomId, size },
  );
  await receiver.waitForFunction(
    ({ roomId, size }) => {
      const p = window.p2party;
      return p
        .roomSelector(p.store.getState())
        .find((r) => r.id === roomId)
        ?.messages.some(
          (m) =>
            m.filename === "release-transfer.bin" &&
            m.savedSize > 0 &&
            m.savedSize < size,
        );
    },
    { roomId, size },
    { timeout: 120000 },
  );
  await sender.evaluate(() => sessionStorage.setItem("resume", "1"));
  await sender.reload();
  const connect = sender.getByRole("button", { name: "Connect", exact: true });
  // A reload can restore consent automatically. Poll both normal outcomes.
  await sender.waitForFunction(
    () =>
      window.p2party?.store &&
      (window.p2party.store.getState().signalingServer.isVerified ||
        [...document.querySelectorAll("button")].some(
          (b) => b.textContent.trim() === "Connect",
        )),
    null,
    { timeout: 30000 },
  );
  if (await connect.isVisible()) await connect.click();
  await sender.waitForFunction(ready, invite, { timeout: 90000 });
  await receiver.waitForFunction(
    ({ roomId, size }) => {
      const p = window.p2party;
      return p
        .roomSelector(p.store.getState())
        .find((r) => r.id === roomId)
        ?.messages.some(
          (m) => m.filename === "release-transfer.bin" && m.savedSize === size,
        );
    },
    { roomId, size },
    { timeout: 240000 },
  );
  const root = await receiver.evaluate(
    async ({ roomId, size, senderPublicKey }) => {
      const p = window.p2party;
      const m = p
        .roomSelector(p.store.getState())
        .find((r) => r.id === roomId)
        .messages.find((m) => m.filename === "release-transfer.bin");
      if (m.fromPeerPublicKey !== senderPublicKey)
        throw new Error("received message lost sender identity");
      const { message } = await p.readMessage(m.merkleRootHex);
      if (!(message instanceof File) || message.size !== size)
        throw new Error("expected disk-backed received file");
      let count = 0;
      for await (const chunk of message.stream())
        for (const b of chunk) {
          if (b !== ((29 * count + (count >>> 16)) & 255))
            throw new Error("received bytes differ");
          count++;
        }
      if (count !== size) throw new Error("received file truncated");
      return m.merkleRootHex;
    },
    { roomId, size, senderPublicKey: senderKey.publicKey },
  );
  console.log(
    "64 MiB verified byte-for-byte after a sender reload during transfer",
  );
  const departingPeer = await sender.evaluate(
    () =>
      window.p2party.keyPairSelector(window.p2party.store.getState()).peerId,
  );
  await sender.evaluate((cap) => window.p2party.purgeRoom(cap), invite);
  await receiver.waitForFunction(
    ({ roomId, peerId }) => {
      const p = window.p2party,
        room = p.roomSelector(p.store.getState()).find((r) => r.id === roomId);
      return (
        room &&
        ![...room.peers, ...(room.knownPeers ?? [])].some(
          (peer) => peer.peerId === peerId,
        )
      );
    },
    { roomId, peerId: departingPeer },
    { timeout: 30000 },
  );
  assert(
    departures.some(
      (f) =>
        f.roomId === roomId &&
        f.peerId === departingPeer &&
        f.protocolVersion === 5 &&
        f.reason === "left",
    ),
    "missing v5 leave notification",
  );
  await receiver.evaluate(
    async ({ invite, root, roomId, size }) => {
      const p = window.p2party;
      const storage = await navigator.storage.getDirectory();
      const files = await storage.getDirectoryHandle("p2party-reassembled");
      const received = await (await files.getFileHandle(root)).getFile();
      if (received.size !== size)
        throw new Error("expected complete OPFS file");
      await p.purgeRoom(invite);
      if (
        (await p.getAllExistingRooms()).some(
          (r) =>
            r.roomUrl === invite || r.roomId === roomId || r.url === invite,
        )
      )
        throw new Error("purged room persisted");
      try {
        await files.getFileHandle(root);
      } catch (error) {
        if (error.name === "NotFoundError") return;
        throw error;
      }
      throw new Error("purged file persisted");
    },
    { invite, root, roomId, size },
  );
  console.log("Remote departure, room purge and disk cleanup verified");
} finally {
  await browser.close();
}
