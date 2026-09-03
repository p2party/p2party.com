export const resolveUniversalLinkTarget = (
  value: string,
): string | undefined => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "p2party.com") return;
    if (url.username !== "" || url.password !== "" || url.port !== "") return;
    if (url.pathname !== "/r") return;
    // The capability, then optionally the room's shape behind an "&" — the
    // only form roomInvitePath produces, and the only one that keeps the shape
    // out of the request. This is a coarse gate on a link arriving from the
    // OS; the policy itself is validated by resolveRoomInvite.
    if (!/^#v1\.[A-Za-z0-9_-]{43}(?:&[A-Za-z0-9_=&-]+)?$/u.test(url.hash))
      return;
    // The query still travels, though it can no longer say anything about a
    // room. Dropping it here would let an older build's link resolve inside
    // the native app as a silent default-policy join, while the same link in a
    // browser is refused with a message that says what to do; carrying it
    // through means resolveRoomInvite refuses both alike.
    return `/r${url.search}${url.hash}`;
  } catch {
    return;
  }
};
