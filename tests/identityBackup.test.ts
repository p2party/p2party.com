import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const stored = new Map<string, string>();
const localStorageStub: Storage = {
  get length() {
    return stored.size;
  },
  clear: () => stored.clear(),
  getItem: (key) => stored.get(key) ?? null,
  key: (index) => [...stored.keys()][index] ?? null,
  removeItem: (key) => {
    stored.delete(key);
  },
  setItem: (key, value) => {
    stored.set(key, value);
  },
};
// Configurable, and only when nothing has stubbed it already: bun runs every
// test file in one process, and a non-configurable stub here makes the next
// file's own stub throw "Attempting to change value of a readonly property".
if (!("localStorage" in globalThis))
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageStub,
    configurable: true,
    writable: true,
  });

const { default: p2party } = await import("p2party");
const {
  createRecoverableIdentity,
  getIdentityBackupStatus,
  INVALID_RECOVERY_PHRASE_MESSAGE,
  identityBackupIsAvailable,
  identityIsRecoverable,
  isInvalidRecoveryPhraseError,
  restoreIdentityFromMnemonic,
  validateMnemonicWords,
} = await import("../src/protocol/identityBackup");

const IDENTITY_BACKUP_CALLS = [
  "createRecoverableIdentity",
  "restoreIdentityFromMnemonic",
  "getIdentityBackupStatus",
  "validateMnemonicWords",
];

/**
 * The adapter reads the SDK surface at call time, which is exactly what lets a
 * test install a build that has the identity-backup API and remove it again.
 * Installing on the real default export keeps the seam honest: the adapter is
 * never handed a stand-in module.
 */
const sdk = p2party as unknown as Record<string, unknown>;

/**
 * What the vendored build had before a test touched a name, so it can be put
 * back exactly. Restoring rather than deleting is what lets these tests run
 * against a build that ships the API: the calls belong to the real default
 * export, which is shared by every test file in the process, and a test that
 * deleted one would take it away from the rest of the run.
 */
const original = new Map<string, { present: boolean; value: unknown }>();

const remember = (name: string) => {
  if (!original.has(name))
    original.set(name, { present: name in sdk, value: sdk[name] });
};

const install = (name: string, implementation: unknown) => {
  remember(name);
  sdk[name] = implementation;
};

/** Take a call away, whether or not the vendored build shipped it. */
const uninstall = (name: string) => {
  remember(name);
  delete sdk[name];
};

afterEach(() => {
  for (const [name, { present, value }] of original) {
    if (present) sdk[name] = value;
    else delete sdk[name];
  }
  original.clear();
});

describe("identity backup adapter without an SDK build that ships it", () => {
  // The missing state is constructed rather than inherited from whichever
  // release happens to be vendored: re-vendoring a build that ships the API
  // must not turn this block red, because a red suite on that step reads as a
  // regression. What is under test is the guard, not the tarball.
  beforeEach(() => {
    for (const name of IDENTITY_BACKUP_CALLS) uninstall(name);
  });

  test("reports the API as unavailable", () => {
    expect(identityBackupIsAvailable()).toBe(false);
  });

  test("throws a build-shaped error, naming the missing function", () => {
    expect(() => validateMnemonicWords("one two three")).toThrow(
      /SDK build without identity backup.*validateMnemonicWords/s,
    );
  });

  test("rejects the async calls with the same build-shaped error", async () => {
    await expect(getIdentityBackupStatus()).rejects.toThrow(
      /SDK build without identity backup.*getIdentityBackupStatus/s,
    );
    await expect(createRecoverableIdentity()).rejects.toThrow(
      /SDK build without identity backup.*createRecoverableIdentity/s,
    );
    await expect(
      restoreIdentityFromMnemonic("abandon abandon"),
    ).rejects.toThrow(
      /SDK build without identity backup.*restoreIdentityFromMnemonic/s,
    );
  });
});

describe("identity backup adapter against an SDK build that ships it", () => {
  test("reports the API as available only when every call exists", () => {
    // Half of the API present is also a constructed state, for the same reason
    // the block above constructs the empty one: the vendored build ships all
    // four, so a partial build has to be built here before it can be observed.
    for (const name of IDENTITY_BACKUP_CALLS) uninstall(name);

    install("validateMnemonicWords", () => ({ ok: true }));
    expect(identityBackupIsAvailable()).toBe(false);

    install("getIdentityBackupStatus", () => Promise.resolve({}));
    install("createRecoverableIdentity", () => Promise.resolve({}));
    install("restoreIdentityFromMnemonic", () => Promise.resolve({}));
    expect(identityBackupIsAvailable()).toBe(true);
  });

  test("passes the phrase through and returns the validation verbatim", () => {
    const seen: string[] = [];
    install("validateMnemonicWords", (words: string) => {
      seen.push(words);
      return { ok: false, reason: 'Word 1, "zzz", is not in the wordlist.' };
    });

    expect(validateMnemonicWords("zzz one two")).toEqual({
      ok: false,
      reason: 'Word 1, "zzz", is not in the wordlist.',
    });
    expect(seen).toEqual(["zzz one two"]);
  });

  test("forwards the restore arguments, phrase and password, unchanged", async () => {
    const calls: unknown[][] = [];
    install("restoreIdentityFromMnemonic", (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve({ publicKey: "ab".repeat(32) });
    });

    await expect(
      restoreIdentityFromMnemonic("phrase words here", "hunter2"),
    ).resolves.toEqual({ publicKey: "ab".repeat(32) });
    expect(calls).toEqual([["phrase words here", "hunter2"]]);
  });

  test("forwards the create options and returns the phrase once", async () => {
    const calls: unknown[][] = [];
    install("createRecoverableIdentity", (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve({ mnemonic: "a b c", publicKey: "cd".repeat(32) });
    });

    await expect(
      createRecoverableIdentity({ strength: 128, password: "hunter2" }),
    ).resolves.toEqual({ mnemonic: "a b c", publicKey: "cd".repeat(32) });
    expect(calls).toEqual([[{ strength: 128, password: "hunter2" }]]);
  });

  test("returns the backup status as the SDK reported it", async () => {
    install("getIdentityBackupStatus", () =>
      Promise.resolve({ publicKey: "ef".repeat(32), derivation: "random" }),
    );

    await expect(getIdentityBackupStatus()).resolves.toEqual({
      publicKey: "ef".repeat(32),
      derivation: "random",
    });
  });
});

describe("deciding whether an identity has a backup", () => {
  test("only a phrase-derived identity counts as recoverable", () => {
    expect(
      identityIsRecoverable({
        publicKey: "ab".repeat(32),
        derivation: "mnemonic",
      }),
    ).toBe(true);
  });

  test('"random" and null both mean no backup exists', () => {
    // null is what every identity created before this feature reports: the SDK
    // records provenance only when it mints a key, so a key already in storage
    // has no record at all. A UI keyed on "random" would hide the offer to
    // switch to a recoverable identity from exactly the users who need it.
    expect(
      identityIsRecoverable({
        publicKey: "ab".repeat(32),
        derivation: "random",
      }),
    ).toBe(false);
    expect(
      identityIsRecoverable({ publicKey: "ab".repeat(32), derivation: null }),
    ).toBe(false);
  });
});

describe("telling a mistyped phrase apart from a failure", () => {
  test("recognises the SDK error by name, not by class identity", () => {
    // The class is not exported by every build the app may be vendoring, so
    // the app must not depend on `instanceof` against an import.
    const invalid = Object.assign(
      new Error("The recovery phrase is invalid."),
      {
        name: "InvalidRecoveryPhraseError",
      },
    );

    expect(isInvalidRecoveryPhraseError(invalid)).toBe(true);
    expect(
      isInvalidRecoveryPhraseError(new Error("storage is unavailable")),
    ).toBe(false);
    expect(isInvalidRecoveryPhraseError("InvalidRecoveryPhraseError")).toBe(
      false,
    );
  });

  test("offers a message that quotes nothing from the phrase", () => {
    // The library's reason reads `Word 3, "zzz", is not in the wordlist.` —
    // one word of the user's secret and its position. It belongs in the form
    // field and nowhere else, so anywhere that reports generically has this
    // instead, and the raw reason keeps a single destination.
    expect(INVALID_RECOVERY_PHRASE_MESSAGE).not.toContain('"');
    expect(INVALID_RECOVERY_PHRASE_MESSAGE.length).toBeGreaterThan(0);
  });
});
