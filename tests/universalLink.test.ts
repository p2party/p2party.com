import { describe, expect, test } from "bun:test";

import { resolveUniversalLinkTarget } from "../src/protocol/universalLink";

const fragment = `#v1.${"A".repeat(43)}`;

describe("resolveUniversalLinkTarget", () => {
  test("accepts only the canonical HTTPS room route", () => {
    expect(
      resolveUniversalLinkTarget(
        `https://p2party.com/r?auth=pin&pq=1024${fragment}`,
      ),
    ).toBe(`/r?auth=pin&pq=1024${fragment}`);
  });

  test.each([
    `http://p2party.com/r${fragment}`,
    `https://evilp2party.com/r${fragment}`,
    `https://p2party.com.example/r${fragment}`,
    `https://p2party.com:444/r${fragment}`,
    `https://user@p2party.com/r${fragment}`,
    `https://p2party.com/rooms${fragment}`,
    "https://p2party.com/r",
    "not a URL",
  ])("rejects untrusted or malformed native link %s", (value) => {
    expect(resolveUniversalLinkTarget(value)).toBeUndefined();
  });
});
