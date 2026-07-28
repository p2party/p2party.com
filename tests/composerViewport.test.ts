import { describe, expect, test } from "bun:test";

import { composerBottomOffset } from "../src/components/MessageInput/viewportGeometry";

describe("mobile composer viewport geometry", () => {
  test("lifts by the visual-only keyboard occlusion", () => {
    expect(composerBottomOffset(844, 500, 0)).toBe(344);
  });

  test("subtracts iOS Safari's visual-viewport pan instead of lifting twice", () => {
    expect(composerBottomOffset(844, 500, 120)).toBe(224);
  });

  test("stays at the layout bottom for Chrome Android and Capacitor resize", () => {
    expect(composerBottomOffset(500, 500, 0)).toBe(0);
  });

  test("does not add shell space that already owns the safe area", () => {
    expect(composerBottomOffset(810, 500, 120)).toBe(190);
  });

  test("clamps transient overscroll and impossible geometry", () => {
    expect(composerBottomOffset(844, 500, -20)).toBe(344);
    expect(composerBottomOffset(500, 600, 20)).toBe(0);
    expect(composerBottomOffset(844, Number.NaN, 0)).toBe(0);
  });
});
