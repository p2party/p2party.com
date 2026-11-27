import { useSyncExternalStore } from "react";

export type PublicWalletTotal = { amount: string; height: string };

const storageKey = "p2party.testnet1.shared-balance.v1";
const changedEvent = "p2party-shared-balance";
const maximumHeight = (1n << 64n) - 1n;

function hasKeys(
  value: unknown,
  keys: string[],
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function boundedDecimal(value: unknown, maximum: bigint): value is string {
  return (
    typeof value === "string" &&
    /^(0|[1-9][0-9]{0,19})$/u.test(value) &&
    BigInt(value) <= maximum
  );
}

function total(amount: unknown, height: unknown): PublicWalletTotal | null {
  return boundedDecimal(amount, 128n) && boundedDecimal(height, maximumHeight)
    ? { amount, height }
    : null;
}

function snapshot(): string | null {
  try {
    return window.sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(changedEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(changedEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useSharedWalletBalance(): PublicWalletTotal | null {
  const value = useSyncExternalStore(subscribe, snapshot, () => null);
  if (!value || value.length > 100) return null;
  try {
    const stored: unknown = JSON.parse(value);
    return hasKeys(stored, ["amount", "height"])
      ? total(stored.amount, stored.height)
      : null;
  } catch {
    return null;
  }
}

export function forgetSharedWalletBalance(): boolean {
  try {
    sessionStorage.removeItem(storageKey);
    window.dispatchEvent(new Event(changedEvent));
    return true;
  } catch {
    return false;
  }
}
