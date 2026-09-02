import { afterEach, describe, expect, test } from "bun:test";

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
  identityBackupIsAvailable,
  isInvalidRecoveryPhraseError,
  restoreIdentityFromMnemonic,
  validateMnemonicWords,
} = await import("../src/protocol/identityBackup");

/**
 * The adapter reads the SDK surface at call time, which is exactly what lets a
 * test install a build that has the identity-backup API and remove it again.
 * Installing on the real default export keeps the seam honest: the adapter is
 * never handed a stand-in module.
 */
const sdk = p2party as unknown as Record<string, unknown>;
const installed = new Set<string>();
const install = (name: string, implementation: unknown) => {
  installed.add(name);
  sdk[name] = implementation;
};

afterEach(() => {
  for (const name of installed) delete sdk[name];
  installed.clear();
});

describe("identity backup adapter without an SDK build that ships it", () => {
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
});
