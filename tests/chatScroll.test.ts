import { describe, expect, test } from "bun:test";

import {
  isLayoutOnlyMessageScroll,
  isNearMessageBottom,
  MESSAGE_BOTTOM_THRESHOLD_PX,
} from "../src/pages/chatScroll";

describe("chat message scroll anchoring", () => {
  test("keeps an exact or near live edge sticky", () => {
    expect(
      isNearMessageBottom({
        scrollHeight: 1200,
        clientHeight: 500,
        scrollTop: 700,
      }),
    ).toBe(true);
    expect(
      isNearMessageBottom({
        scrollHeight: 1200,
        clientHeight: 500,
        scrollTop: 700 - MESSAGE_BOTTOM_THRESHOLD_PX,
      }),
    ).toBe(true);
  });

  test("does not yank a reader browsing older messages", () => {
    expect(
      isNearMessageBottom({
        scrollHeight: 1200,
        clientHeight: 500,
        scrollTop: 700 - MESSAGE_BOTTOM_THRESHOLD_PX - 1,
      }),
    ).toBe(false);
  });

  test("treats a short empty or first-message list as the live edge", () => {
    expect(
      isNearMessageBottom({
        scrollHeight: 320,
        clientHeight: 500,
        scrollTop: 0,
      }),
    ).toBe(true);
  });
});

describe("message viewport resize ownership", () => {
  test("ignores only a layout-only scroll event", () => {
    const geometry = {
      scrollHeight: 1200,
      clientHeight: 500,
      scrollTop: 700,
    };

    expect(isLayoutOnlyMessageScroll(geometry, geometry)).toBe(false);
    expect(
      isLayoutOnlyMessageScroll(geometry, {
        scrollHeight: 1200,
        clientHeight: 384,
        scrollTop: 700,
      }),
    ).toBe(true);
  });

  test("reader movement wins even in the same frame as a resize", () => {
    expect(
      isLayoutOnlyMessageScroll(
        {
          scrollHeight: 1200,
          clientHeight: 500,
          scrollTop: 700,
        },
        {
          scrollHeight: 1200,
          clientHeight: 384,
          scrollTop: 240,
        },
      ),
    ).toBe(false);
    expect(
      isNearMessageBottom({
        scrollHeight: 1200,
        clientHeight: 384,
        scrollTop: 240,
      }),
    ).toBe(false);
  });
});
