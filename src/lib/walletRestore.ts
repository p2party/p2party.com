import { Capacitor } from "@capacitor/core";

export function walletDocumentHref(
  href: string,
  native = Capacitor.isNativePlatform(),
) {
  // Capacitor's local webview routes and session storage are separate from the website.
  if (!native || !/^\/wallet(?:[/?#]|$)/u.test(href)) return href;
  return (
    "https://p2party.com" + href.replace(/^\/wallet(?=[?#]|$)/u, "/wallet/")
  );
}

export const WALLET_HOME_URL = walletDocumentHref("/wallet/");
export const WALLET_RESTORE_URL = WALLET_HOME_URL + "#restore";
export const WALLET_CREATE_URL = WALLET_HOME_URL + "#create";
export const WALLET_RECEIVE_URL = WALLET_HOME_URL + "#receive";
export const WALLET_BALANCE_URL = WALLET_HOME_URL + "#balance";
