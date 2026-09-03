import { describe, expect, test } from "bun:test";

import { resolveUniversalLinkTarget } from "../src/protocol/universalLink";

const fragment = `#v1.${"A".repeat(43)}`;

describe("resolveUniversalLinkTarget", () => {
  test("accepts the canonical HTTPS room route, query and all", () => {
    // Nothing produces this shape any more, and the app now refuses it as an
    // invitation from an older build. The query still has to reach the app to
    // be refused: drop it here and the native shell would resolve an old PIN
    // link to the default no-PIN policy and fail the handshake in silence,
    // while the same link opened in a browser says what is wrong.
    expect(
      resolveUniversalLinkTarget(
        `https://p2party.com/r?auth=pin&pq=1024${fragment}`,
      ),
    ).toBe(`/r?auth=pin&pq=1024${fragment}`);
  });

  test("accepts a native link whose room shape rides in the fragment", () => {
    // Links this build produces put the policy after the "#", so the native
    // deep-link gate has to let it through or every PIN, non-default-suite
    // and scheduled invitation stops opening the app.
    expect(
      resolveUniversalLinkTarget(`https://p2party.com/r${fragment}&auth=pin`),
    ).toBe(`/r${fragment}&auth=pin`);
    expect(
      resolveUniversalLinkTarget(
        `https://p2party.com/r${fragment}&auth=pin&pq=1024`,
      ),
    ).toBe(`/r${fragment}&auth=pin&pq=1024`);
    expect(
      resolveUniversalLinkTarget(
        `https://p2party.com/r${fragment}&policy=${"A".repeat(43)}`,
      ),
    ).toBe(`/r${fragment}&policy=${"A".repeat(43)}`);
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
