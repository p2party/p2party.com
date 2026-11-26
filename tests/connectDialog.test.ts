import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

interface MemoryStorage extends Storage {
  rows: Map<string, string>;
}

function memoryStorage(
  initial: Record<string, string> = {},
  { failWrites = false } = {},
): MemoryStorage {
  const rows = new Map(Object.entries(initial));
  return {
    rows,
    get length() {
      return rows.size;
    },
    clear: () => rows.clear(),
    getItem: (key) => rows.get(key) ?? null,
    key: (index) => [...rows.keys()][index] ?? null,
    removeItem: (key) => {
      rows.delete(key);
    },
    setItem: (key, value) => {
      if (failWrites)
        throw new DOMException(
          "The quota has been exceeded.",
          "QuotaExceededError",
        );
      rows.set(key, value);
    },
  };
}

// The SDK reads localStorage as it loads. Configurable, and only when nothing
// has stubbed it already: bun runs every test file in one process.
if (!("localStorage" in globalThis))
  Object.defineProperty(globalThis, "localStorage", {
    value: memoryStorage(),
    configurable: true,
    writable: true,
  });

const { default: p2party } = await import("p2party");
const {
  ROOM_UI_TAG_DOMAIN,
  migrateLegacyRoomUiKeys,
  roomUiTagFromCapability,
  scrubLegacyRoomUiKeysAtStartup,
} = await import("../src/protocol/roomUiStorage");
const { connectDialogDismissedKey, connectDialogOpenKey, roomUiTag } =
  await import("../src/protocol/roomUiKeys");
const { settlePurge } = await import("../src/hooks/usePurge");

/**
 * What BASE (92840c1) wrote for the join dialog, generated from its own key
 * builders before this change: two synthetic rooms, the room-less bucket, and
 * the JSON values usehooks-ts stores.
 */
const legacy = JSON.parse(
  readFileSync(
    join(import.meta.dir, "fixtures", "base-92840c1-room-ui-localstorage.json"),
    "utf8",
  ),
) as {
  capabilities: { roomA: string; roomB: string };
  rows: Record<string, string>;
};
const { roomA, roomB } = legacy.capabilities;

/** Every spelling the library accepts for one room. */
const spellings = (roomUrl: string): string[] => {
  const capability = p2party.decodeRoomCapability(roomUrl);
  const compact = p2party.encodeRoomCapabilityBase64Url(capability);
  return [roomUrl, roomUrl.toUpperCase(), compact, `v1.${compact}`];
};

/** The tag as the decision states it, computed with node's own SHA-256. */
const referenceTag = (roomUrl: string): string =>
  createHash("sha256")
    .update(new TextEncoder().encode(ROOM_UI_TAG_DOMAIN))
    .update(p2party.decodeRoomCapability(roomUrl))
    .digest("hex")
    .slice(0, 32);

/** Keys that are not this app's per-room flags and must survive everything. */
const UNRELATED = {
  signalingServerUrl: JSON.stringify("ws://127.0.0.1:5999"),
  chunksToSplitMessage: "1",
  percentageFilledChunk: "90",
};

const keysNaming = (storage: MemoryStorage, roomUrl: string): string[] => {
  const forms = spellings(roomUrl).map((form) => form.toLowerCase());
  return [...storage.rows.keys()].filter((key) =>
    forms.some((form) => key.toLowerCase().includes(form)),
  );
};

const resolvingSteps = () => {
  const calls: string[] = [];
  return {
    calls,
    steps: {
      purgeIdentity: async () => {
        calls.push("purgeIdentity");
      },
      purge: async () => {
        calls.push("purge");
      },
      purgeRoom: async (roomUrl: string) => {
        calls.push(`purgeRoom ${roomUrl}`);
      },
    },
  };
};

describe("per-room join dialog keys", () => {
  test("per-room keys do not contain the capability", () => {
    for (const roomUrl of [roomA, roomB]) {
      const open = connectDialogOpenKey(roomUrl);
      const dismissed = connectDialogDismissedKey(roomUrl);

      for (const form of spellings(roomUrl)) {
        expect(open.toLowerCase()).not.toContain(form.toLowerCase());
        expect(dismissed.toLowerCase()).not.toContain(form.toLowerCase());
        // One room, one pair of keys, however its capability is spelled.
        expect(connectDialogOpenKey(form)).toBe(open);
        expect(connectDialogDismissedKey(form)).toBe(dismissed);
      }

      const tag = referenceTag(roomUrl);
      expect(open).toBe(`alertIsOpenInRoom:${tag}`);
      expect(dismissed).toBe(`pressedCancelButtonInRoom:${tag}`);
    }

    expect(connectDialogOpenKey(roomA)).not.toBe(connectDialogOpenKey(roomB));
  });

  test("a room-less route keeps its single shared bucket", () => {
    // The layout renders before an invite fragment resolves, so the key was
    // built from `undefined` and JavaScript stringified it. Same bucket, and
    // anything that is not a capability names no room either.
    expect(connectDialogOpenKey(undefined)).toBe("alertIsOpenInRoomundefined");
    expect(connectDialogDismissedKey(undefined)).toBe(
      "pressedCancelButtonInRoomundefined",
    );
    expect(connectDialogOpenKey("")).toBe("alertIsOpenInRoomundefined");
    expect(connectDialogOpenKey("not a room")).toBe(
      "alertIsOpenInRoomundefined",
    );
  });

  test("legacy keys are migrated and removed", () => {
    const sdkFlag = `${roomA}-onlyConnectWithKnownPeers`;
    const storage = memoryStorage({
      ...legacy.rows,
      ...UNRELATED,
      // The library's own per-room flag. Its owner migrates it; dropping it
      // here would silently turn "only known peers" off for that room.
      [sdkFlag]: "true",
    });

    migrateLegacyRoomUiKeys(storage);

    // Nothing this app owns names either room any more.
    expect(keysNaming(storage, roomA)).toEqual([sdkFlag]);
    expect(keysNaming(storage, roomB)).toEqual([]);

    // Each answer survives under the room's tag: a dismissed dialog stays
    // dismissed across the upgrade.
    expect(storage.getItem(connectDialogOpenKey(roomA))).toBe("false");
    expect(storage.getItem(connectDialogDismissedKey(roomA))).toBe("true");
    expect(storage.getItem(connectDialogOpenKey(roomB))).toBe("true");
    expect(storage.getItem(connectDialogDismissedKey(roomB))).toBe("false");

    // The room-less bucket and everything else are left alone.
    expect(storage.getItem("alertIsOpenInRoomundefined")).toBe("true");
    expect(storage.getItem("pressedCancelButtonInRoomundefined")).toBe("true");
    for (const [key, value] of Object.entries(UNRELATED))
      expect(storage.getItem(key)).toBe(value);
    expect(storage.getItem(sdkFlag)).toBe("true");
    expect(storage.length).toBe(4 + 2 + Object.keys(UNRELATED).length + 1);

    // A second start finds nothing to do.
    const after = new Map(storage.rows);
    migrateLegacyRoomUiKeys(storage);
    expect(storage.rows).toEqual(after);
  });

  test("a legacy key in any other spelling is dropped, and a current answer wins", () => {
    const compactB = spellings(roomB)[2];
    const storage = memoryStorage({
      // Written by a tab still running the older build after this one had
      // already answered for the room under its tag.
      [`alertIsOpenInRoom${roomA}`]: "true",
      [connectDialogOpenKey(roomA)]: "false",
      // Upper-case hex decodes to the same room and is carried over.
      [`pressedCancelButtonInRoom${roomA.toUpperCase()}`]: "false",
      // A spelling no build wrote. It still names a room, so it goes, but the
      // scrub decodes only hex and does not carry it over.
      [`pressedCancelButtonInRoom${compactB}`]: "true",
      // Not a capability in any spelling: dropped, not carried over.
      alertIsOpenInRoomnotaroom: "true",
      alertIsOpenInRoom: "false",
    });

    migrateLegacyRoomUiKeys(storage);

    expect(Object.fromEntries(storage.rows)).toEqual({
      [connectDialogOpenKey(roomA)]: "false",
      [connectDialogDismissedKey(roomA)]: "false",
    });
  });

  test("legacy keys are migrated on a non-room route", () => {
    // The scrub decodes the legacy hex itself, and the room pages decode
    // through the SDK. Both must name the same keys for the same room, or a
    // migrated answer would sit where the room page never looks.
    for (const roomUrl of [roomA, roomB]) {
      const bytes = Uint8Array.from(Buffer.from(roomUrl, "hex"));
      expect(roomUiTagFromCapability(bytes)).toBe(roomUiTag(roomUrl));
      expect(roomUiTag(roomUrl)).toBe(referenceTag(roomUrl));
    }

    // The entry's own call, on the BASE fixture.
    const storage = memoryStorage({ ...legacy.rows, ...UNRELATED });
    scrubLegacyRoomUiKeysAtStartup(() => storage);

    expect(keysNaming(storage, roomA)).toEqual([]);
    expect(keysNaming(storage, roomB)).toEqual([]);
    expect(storage.getItem(connectDialogOpenKey(roomA))).toBe("false");
    expect(storage.getItem(connectDialogDismissedKey(roomA))).toBe("true");
    expect(storage.getItem(connectDialogOpenKey(roomB))).toBe("true");
    expect(storage.getItem(connectDialogDismissedKey(roomB))).toBe("false");
    for (const [key, value] of Object.entries(UNRELATED))
      expect(storage.getItem(key)).toBe(value);

    // The entry runs it at the top level of main.tsx: on every route, once per
    // load, before the first render.
    const entry = readFileSync(
      join(import.meta.dir, "..", "src", "main.tsx"),
      "utf8",
    );
    const call = entry.indexOf(
      "\nscrubLegacyRoomUiKeysAtStartup(() => window.localStorage);\n",
    );
    expect(call).toBeGreaterThan(-1);
    expect(call).toBeLessThan(entry.indexOf("const boot"));
    expect(call).toBeLessThan(entry.indexOf("void boot()"));
  });

  test("the startup scrub is safe when storage is unavailable or throws", () => {
    const insecure = () =>
      new DOMException("The operation is insecure.", "SecurityError");

    expect(() => {
      scrubLegacyRoomUiKeysAtStartup(() => {
        throw insecure();
      });
    }).not.toThrow();

    for (const method of ["key", "getItem", "removeItem"] as const) {
      const storage = memoryStorage(legacy.rows);
      storage[method] = () => {
        throw insecure();
      };
      expect(() => {
        scrubLegacyRoomUiKeysAtStartup(() => storage);
      }).not.toThrow();
    }
  });

  test("legacy keys are removed even when storage is full", () => {
    const storage = memoryStorage(legacy.rows, { failWrites: true });

    expect(() => {
      migrateLegacyRoomUiKeys(storage);
    }).not.toThrow();

    // The answers are lost -- the dialog asks again -- but the capabilities
    // are not kept to save them.
    expect(keysNaming(storage, roomA)).toEqual([]);
    expect(keysNaming(storage, roomB)).toEqual([]);
    expect([...storage.rows.keys()].sort()).toEqual([
      "alertIsOpenInRoomundefined",
      "pressedCancelButtonInRoomundefined",
    ]);
  });
});

describe("purging the join dialog keys", () => {
  const seeded = () =>
    memoryStorage({
      [connectDialogOpenKey(roomA)]: "false",
      [connectDialogDismissedKey(roomA)]: "true",
      [connectDialogOpenKey(roomB)]: "true",
      [connectDialogDismissedKey(roomB)]: "false",
      // A tab still on the older build may have written this since startup.
      [`pressedCancelButtonInRoom${roomA}`]: "true",
      alertIsOpenInRoomundefined: "true",
      ...UNRELATED,
    });

  // The native attachment copies are not the subject here.
  const noFileCopies = () => Promise.resolve();

  test("purge removes per-room keys", async () => {
    // One room: that room's keys, in every spelling, and nothing else.
    const room = seeded();
    const roomRun = resolvingSteps();
    const roomOutcome = await settlePurge(
      "room",
      roomA,
      roomRun.steps,
      () => room,
      noFileCopies,
    );
    expect(roomRun.calls).toEqual([`purgeRoom ${roomA}`]);
    expect(roomOutcome.tone).toBe("good");
    expect(room.getItem(connectDialogOpenKey(roomA))).toBeNull();
    expect(room.getItem(connectDialogDismissedKey(roomA))).toBeNull();
    expect(keysNaming(room, roomA)).toEqual([]);
    expect(room.getItem(connectDialogOpenKey(roomB))).toBe("true");
    expect(room.getItem(connectDialogDismissedKey(roomB))).toBe("false");
    expect(room.getItem("alertIsOpenInRoomundefined")).toBe("true");
    for (const [key, value] of Object.entries(UNRELATED))
      expect(room.getItem(key)).toBe(value);

    // Everything: every room's keys and the room-less bucket.
    const everything = seeded();
    const everythingRun = resolvingSteps();
    const everythingOutcome = await settlePurge(
      "everything",
      roomA,
      everythingRun.steps,
      () => everything,
      noFileCopies,
    );
    expect(everythingRun.calls).toEqual(["purge"]);
    expect(everythingOutcome.tone).toBe("good");
    expect(Object.fromEntries(everything.rows)).toEqual(UNRELATED);

    // The identity purge leaves rooms alone, and says so.
    const identity = seeded();
    const before = new Map(identity.rows);
    const identityRun = resolvingSteps();
    await settlePurge(
      "identity",
      roomA,
      identityRun.steps,
      () => identity,
      noFileCopies,
    );
    expect(identityRun.calls).toEqual(["purgeIdentity"]);
    expect(identity.rows).toEqual(before);
  });

  test("purge removes per-room keys when the library purge fails", async () => {
    const storage = seeded();
    const outcome = await settlePurge(
      "everything",
      undefined,
      {
        ...resolvingSteps().steps,
        purge: () => Promise.reject(new Error("database worker refused")),
      },
      () => storage,
      noFileCopies,
    );

    expect(Object.fromEntries(storage.rows)).toEqual(UNRELATED);
    expect(outcome.tone).toBe("bad");
    expect(outcome.causes).toEqual(["database worker refused"]);
    expect(outcome.retryable).toBe(true);
  });

  test("a purge that cannot reach storage does not report success", async () => {
    const blocked = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };

    const room = await settlePurge(
      "room",
      roomA,
      resolvingSteps().steps,
      blocked,
      noFileCopies,
    );
    expect(room.tone).toBe("bad");
    expect(room.causes).toEqual(["The operation is insecure."]);

    // The narrow "only the server's unlink is unconfirmed" report is a promise
    // that every local step finished. A storage failure voids it.
    const unconfirmed = Object.assign(new Error("ack timed out"), {
      name: "RemoteRoomRevocationUnconfirmedError",
      reason: "ack-timeout",
    });
    const both = await settlePurge(
      "room",
      roomA,
      {
        ...resolvingSteps().steps,
        purgeRoom: () => Promise.reject(unconfirmed),
      },
      blocked,
      noFileCopies,
    );
    expect(both.tone).toBe("bad");
    expect(both.causes).toEqual([
      "ack timed out",
      "The operation is insecure.",
    ]);

    // Without a storage failure the narrow report still stands.
    const narrow = await settlePurge(
      "room",
      roomA,
      {
        ...resolvingSteps().steps,
        purgeRoom: () => Promise.reject(unconfirmed),
      },
      () => seeded(),
      noFileCopies,
    );
    expect(narrow.tone).toBe("warn");
  });
});

describe("per-room key spellings", () => {
  const srcRoot = join(import.meta.dir, "..", "src");
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? sources(join(dir, entry.name))
        : /\.(ts|tsx)$/u.test(entry.name)
          ? [join(dir, entry.name)]
          : [],
    );

  test("are written in one module only", () => {
    // A call site that concatenates its own key puts the capability back in
    // storage, out of reach of the migration and the purge.
    const spelledIn = sources(srcRoot)
      .filter((file) =>
        /alertIsOpenInRoom|pressedCancelButtonInRoom/u.test(
          readFileSync(file, "utf8"),
        ),
      )
      .map((file) => relative(srcRoot, file));

    expect(spelledIn).toEqual(["protocol/roomUiStorage.ts"]);
  });
});

describe("the startup scrub's imports", () => {
  const srcRoot = join(import.meta.dir, "..", "src");
  const SDK_MODULE = join(srcRoot, "protocol", "sdk.ts");

  /**
   * Everything a module pulls in before it can run: static `import ... from`,
   * `export ... from` and bare `import "..."`, followed through relative
   * paths. `import type` is erased at build time and a dynamic `import()` is a
   * separate chunk, so neither counts.
   */
  const staticGraph = (
    entry: string,
  ): { files: Set<string>; packages: Set<string> } => {
    const files = new Set<string>();
    const packages = new Set<string>();
    const statement =
      /(?:^|[\n;])\s*(?:import|export)\s+(?!type\s)(?:[^'"()]*?\s+from\s+)?["']([^"']+)["']/gu;
    const visit = (file: string) => {
      if (files.has(file)) return;
      files.add(file);
      const source = readFileSync(file, "utf8");
      for (const [, specifier] of source.matchAll(statement)) {
        if (!specifier.startsWith(".")) {
          packages.add(specifier);
          continue;
        }
        const base = resolve(dirname(file), specifier);
        const target = [
          base,
          `${base}.ts`,
          `${base}.tsx`,
          join(base, "index.ts"),
          join(base, "index.tsx"),
        ].find(
          (candidate) => /\.tsx?$/u.test(candidate) && existsSync(candidate),
        );
        if (target !== undefined) visit(target);
      }
    };
    visit(entry);
    return { files, packages };
  };

  test("scrub module does not import the SDK", () => {
    // The app entry runs the scrub on every route. If its module reached the
    // SDK, every page -- the landing page, every blog post -- would load the
    // whole WebRTC and cryptography bundle to move two localStorage keys.
    const scrub = staticGraph(join(srcRoot, "protocol", "roomUiStorage.ts"));
    expect([...scrub.files].map((file) => relative(srcRoot, file))).toEqual([
      "protocol/roomUiStorage.ts",
      "lib/sha256.ts",
    ]);
    expect([...scrub.packages]).toEqual([]);

    // Nor does the entry that calls it, statically.
    const entry = staticGraph(join(srcRoot, "main.tsx"));
    expect(entry.files.has(join(srcRoot, "protocol", "roomUiStorage.ts"))).toBe(
      true,
    );
    expect(entry.files.has(SDK_MODULE)).toBe(false);
    expect(entry.packages.has("p2party")).toBe(false);

    // The walk does see the SDK where it is imported, so the checks above are
    // not passing for want of looking.
    const roomPages = staticGraph(join(srcRoot, "protocol", "roomUiKeys.ts"));
    expect(roomPages.files.has(SDK_MODULE)).toBe(true);
    expect(roomPages.packages.has("p2party")).toBe(true);
  });
});
