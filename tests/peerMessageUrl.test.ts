import { describe, expect, mock, test } from "bun:test";

import {
  openPeerMessageUrl,
  peerMessageUrl,
} from "../src/protocol/peerMessageUrl";

describe("peer message links", () => {
  test("preserves an HTTPS invitation's query and fragment", () => {
    const value = "https://example.com/r?view=chat#v1.capability&auth=pin";
    expect(peerMessageUrl(value)).toBe(value);
    expect(peerMessageUrl("http://localhost:3000/rooms")).toBe(
      "http://localhost:3000/rooms",
    );
  });

  test.each([
    "javascript:alert(document.domain)",
    "java\nscript:alert(document.domain)",
    "data:text/html,<script>alert(1)</script>",
    "blob:https://example.com/peer-content",
    "file:///etc/passwd",
    "ftp://example.com/file",
    "//example.com/room",
    "/r#secret",
    "example.com",
    "https://trusted.example@attacker.example/",
    "https://user:password@example.com/",
    "https://exa\tmple.com/",
    "https://example.com/\u0000",
    "ordinary chat text",
  ])("refuses unsafe or ambiguous destination %s", (value) => {
    const open = mock(() => null);
    expect(peerMessageUrl(value)).toBeUndefined();
    openPeerMessageUrl(value, { open });
    expect(open).not.toHaveBeenCalled();
  });

  test("opens peer pages without an opener or a referrer", () => {
    const open = mock(() => null);
    openPeerMessageUrl("https://example.com/", { open });
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      "https://example.com/",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
