/** A peer's message may link to a web page, never to executable or local URLs. */
export const peerMessageUrl = (value: string): string | undefined => {
  // URL parsing removes some control characters; refuse them before parsing so
  // the visible message cannot disguise the scheme or destination we open.
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return;
    if (url.username !== "" || url.password !== "") return;
    return url.href;
  } catch {
    return;
  }
};

export const openPeerMessageUrl = (
  value: string,
  browser: Pick<Window, "open"> = window,
): void => {
  const url = peerMessageUrl(value);
  if (url === undefined) return;
  // window.open does not inherit the implicit noopener behavior of <a> tags.
  // A page chosen by a peer must not be able to navigate the chat's window.
  browser.open(url, "_blank", "noopener,noreferrer");
};
