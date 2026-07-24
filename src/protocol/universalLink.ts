export const resolveUniversalLinkTarget = (
  value: string,
): string | undefined => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "p2party.com") return;
    if (url.username !== "" || url.password !== "" || url.port !== "") return;
    if (url.pathname !== "/r") return;
    if (!/^#v1\.[A-Za-z0-9_-]{43}$/u.test(url.hash)) return;
    return `/r${url.search}${url.hash}`;
  } catch {
    return;
  }
};
