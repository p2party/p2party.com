import { expect, test } from "bun:test";
import { walletDocumentHref } from "../src/lib/walletRestore";

test("native webviews open the wallet and its intent on the canonical HTTPS site", () => {
  for (const href of [
    "/wallet",
    "/wallet/",
    "/wallet#restore",
    "/wallet/#create",
    "/wallet/#receive",
    "/wallet/#balance",
    "/wallet/help/#watch=0x1234",
    "/wallet/restore-wallet.html",
  ]) {
    const url = new URL(walletDocumentHref(href, true));
    expect(url.origin).toBe("https://p2party.com");
    expect(url.pathname.startsWith("/wallet/")).toBe(true);
    expect(url.hash).toBe(new URL(href, "https://localhost").hash);
    expect(walletDocumentHref(href, false)).toBe(href);
  }
  for (const href of [
    "/wallets/",
    "/rooms/",
    "/protocol/",
    "/r#v1.room",
    "//example.org/wallet/",
  ]) {
    expect(walletDocumentHref(href, true)).toBe(href);
  }
});
