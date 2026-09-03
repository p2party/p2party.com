export const resolveUniversalLinkTarget = (
  value: string,
): string | undefined => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "p2party.com") return;
    if (url.username !== "" || url.password !== "" || url.port !== "") return;
    if (url.pathname !== "/r") return;
    // The capability, then optionally the room's shape behind an "&" — the
    // form roomInvitePath now produces, which keeps the shape out of the
    // request. This is a coarse gate on a link arriving from the OS; the
    // policy itself is validated by resolveRoomInvite, against the same
    // allowlist as the legacy query-string form.
    if (!/^#v1\.[A-Za-z0-9_-]{43}(?:&[A-Za-z0-9_=&-]+)?$/u.test(url.hash))
      return;
    return `/r${url.search}${url.hash}`;
  } catch {
    return;
  }
};
