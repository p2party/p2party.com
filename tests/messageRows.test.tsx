import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Message } from "p2party";

// The SDK reads localStorage as it loads. Configurable, and only when nothing
// has stubbed it already: bun runs every test file in one process.
if (!("localStorage" in globalThis))
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      length: 0,
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    } satisfies Storage,
    configurable: true,
    writable: true,
  });

const { renderToString } = await import("react-dom/server");
const { Provider } = await import("react-redux");
const { default: p2party } = await import("p2party");
const { default: MessageItem } = await import("../src/components/MessageItem");

/** The declarations of one class rule in the app stylesheet. */
const ruleDeclarations = (selector: string): Record<string, string> => {
  const css = readFileSync(
    join(import.meta.dir, "..", "src", "index.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//gu, "");
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const body = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "u").exec(css)?.[1];
  if (body === undefined) return {};
  return Object.fromEntries(
    body
      .split(";")
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration.length > 0)
      .map((declaration) => {
        const colon = declaration.indexOf(":");
        return [
          declaration.slice(0, colon).trim(),
          declaration.slice(colon + 1).trim(),
        ];
      }),
  );
};

/** The class list of the outermost element a component rendered. */
const rootClasses = (html: string): string[] =>
  (/^<[a-z]+[^>]*\sclass="([^"]*)"/u.exec(html)?.[1] ?? "").split(/\s+/u);

const message = (fromPeerId: string): Message =>
  ({
    merkleRootHex: "ab".repeat(32),
    sha512Hex: "cd".repeat(64),
    fromPeerId,
    timestamp: 0,
    totalChunks: 1,
    chunksCreated: 1,
    savedSize: 5,
    totalSize: 5,
    channelLabel: "main",
  }) as unknown as Message;

describe("long message histories", () => {
  test("message rows skip rendering while off screen", () => {
    // Every row of a long history used to be laid out and painted on every
    // render, visible or not. A row that is off screen now keeps only a
    // placeholder box; `auto` makes that box the row's last rendered size, so
    // scrolling back past it does not jump.
    const declarations = ruleDeclarations(".message-row");
    expect(declarations["content-visibility"]).toBe("auto");
    expect(declarations["contain-intrinsic-size"]).toMatch(
      /^auto \d+(\.\d+)?(px|rem)$/u,
    );

    // Both shapes of row carry the class on the element the list lays out:
    // the chat page's direct child of the history, which is also what its
    // scroll anchoring measures.
    const ownPeerId = p2party.keyPairSelector(p2party.store.getState()).peerId;
    for (const fromPeerId of [ownPeerId, "ef".repeat(32)]) {
      const html = renderToString(
        <Provider store={p2party.store}>
          <MessageItem message={message(fromPeerId)} roomId='room' />
        </Provider>,
      );
      expect(rootClasses(html)).toContain("message-row");
    }
  });
});
