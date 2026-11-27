import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
// Start the dev site and a disposable protocol-v5 signaling server first.
const origin = process.env.APP_URL ?? "http://127.0.0.1:5853";
const signaling = process.env.SIGNALING_URL ?? "ws://127.0.0.1:5852/ws";
const stun = process.env.STUN_URL;
for (const endpoint of [origin, signaling]) {
  const url = new URL(endpoint);
  assert(
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
      Number(url.port) > 5000,
    "use explicit loopback test endpoints above port 5000",
  );
}
const old = execFileSync(
  "tar",
  [
    "-xOf",
    fileURLToPath(
      new URL("../vendor/p2party-0.15.0-rc.0.tgz", import.meta.url),
    ),
    "package/lib/index.min.js",
  ],
  { maxBuffer: 16 * 1024 * 1024 },
);
const browser = await chromium.launch();
const newContext = async () => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(
    ({ signaling, stun }) => {
      localStorage.setItem("signalingServerUrl", JSON.stringify(signaling));
      localStorage.setItem(
        "stunServerUrls",
        JSON.stringify(stun ? [stun] : []),
      );
    },
    { signaling, stun },
  );
  return ctx;
};
const join = async (page, cap) => {
  await page.goto(origin + "/r#v1." + cap.toString("base64url"));
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.waitForFunction(
    (hex) =>
      window.p2party?.store.getState().rooms.find((r) => r.url === hex)?.id,
    cap.toString("hex"),
  );
};
try {
  const bob = await newContext(),
    bobPage = await bob.newPage();
  await join(bobPage, randomBytes(32));
  const bobKey = await bobPage.evaluate(
    () => window.p2party.store.getState().keyPair.publicKey,
  );
  assert.match(bobKey, /^[a-f0-9]{64}$/);
  await bobPage.close();
  const alice = await newContext(),
    page = await alice.newPage();
  await page.route(origin + "/rc0-seed", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body>previous SDK</body></html>",
    }),
  );
  await page.goto(origin + "/rc0-seed");
  await page.addScriptTag({ content: old.toString() });
  const oldId = randomUUID(),
    blockedKey = randomBytes(32).toString("hex");
  await page.evaluate(
    async ({ bobKey, oldId, blockedKey }) => {
      const P = window.p2party;
      await P.addPeerToAddressBook("Bob", oldId, bobKey);
      await P.blacklistPeer(oldId, blockedKey);
    },
    { bobKey, oldId, blockedKey },
  );
  assert.equal(
    await page.evaluate(
      async () =>
        (await indexedDB.databases()).find((x) => x.name === "p2party").version,
    ),
    22,
  );
  const cap = randomBytes(32);
  await join(page, cap);
  await page.evaluate(
    (hex) => window.p2party.onlyAllowConnectionsFromAddressBook(hex, true),
    cap.toString("hex"),
  );
  const migrated = await page.evaluate(
    async ({ bobKey, blockedKey, oldId }) => {
      const P = window.p2party;
      let error;
      try {
        await P.getPeerIsBlacklisted(oldId);
      } catch (e) {
        error = e.name;
      }
      return {
        db: (await indexedDB.databases()).find((x) => x.name === "p2party")
          .version,
        contact: await P.getPeerAddressBookEntry(bobKey),
        blocked: await P.getPeerIsBlacklisted(blockedKey),
        idError: error,
      };
    },
    { bobKey, blockedKey, oldId },
  );
  assert.equal(migrated.db, 23);
  assert.equal(migrated.contact.peerId, oldId);
  assert.equal(migrated.contact.username, "Bob");
  assert.equal(migrated.blocked, true);
  assert.equal(migrated.idError, "TypeError");
  const bobRoom = await bob.newPage();
  await join(bobRoom, cap);
  await page.waitForFunction(
    ({ key, hex }) => {
      const r = window.p2party.store
        .getState()
        .rooms.find((x) => x.url === hex);
      return r.peers.some(
        (p) =>
          p.peerPublicKey === key &&
          r.handshakeStatusByPeer?.[p.peerId]?.status === "authenticated",
      );
    },
    { key: bobKey, hex: cap.toString("hex") },
    { timeout: 45000 },
  );
  const newId = await bobRoom.evaluate(
    () => window.p2party.store.getState().keyPair.peerId,
  );
  assert.notEqual(newId, oldId);
  assert.equal(
    await page.evaluate(
      async (k) => (await window.p2party.getPeerAddressBookEntry(k)).peerId,
      bobKey,
    ),
    newId,
  );
  // The stable key is blocked from another tab precisely when the main transport
  // has finished its identity proof, while the signaling admission already passed.
  // Run a new room so no previously authenticated connection is shared.
  await Promise.all([page.close(), bobRoom.close()]);
  const raceCap = randomBytes(32);
  const racePage = await alice.newPage();
  await racePage.addInitScript((k) => {
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (msg, ...rest) {
      const worker = this;
      if (
        msg?.method === "recordAuthenticatedPeer" &&
        msg.args[1] === k &&
        !window.__blockAtProof
      ) {
        window.__blockAtProof = true;
        const req = indexedDB.open("p2party");
        req.onsuccess = () => {
          const db = req.result,
            tx = db.transaction("blacklist", "readwrite");
          tx.objectStore("blacklist").put({
            peerId: msg.args[0],
            peerPublicKey: k,
            dateAdded: Date.now(),
          });
          tx.oncomplete = () => {
            db.close();
            post.call(worker, msg, ...rest);
          };
        };
        return;
      }
      return post.call(worker, msg, ...rest);
    };
  }, bobKey);
  await join(racePage, raceCap);
  const bobRace = await bob.newPage();
  await join(bobRace, raceCap);
  await racePage.waitForFunction(
    (hex) => {
      const r = window.p2party.store
        .getState()
        .rooms.find((x) => x.url === hex);
      return (
        window.__blockAtProof &&
        Object.values(r.handshakeStatusByPeer ?? {}).some(
          (s) => s.status === "failed" && s.reason === "policy",
        )
      );
    },
    raceCap.toString("hex"),
    { timeout: 45000 },
  );
  console.log(
    "PASS RC.0 SDK wrote v22 rows; the installed SDK migrated and kept keys, refused ID-only lookup; known-only join re-bound the old contact after a real handshake. A block committed at the proof boundary refused the authenticated edge.",
  );
} finally {
  await browser.close();
}
