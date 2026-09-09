import { describe, expect, test } from "bun:test";

import {
  boundedComposerHeight,
  composerHeightLimit,
  MESSAGE_COMPOSER_MAX_HEIGHT_PX,
} from "../src/components/MessageInput/viewportGeometry";

describe("long chat drafts", () => {
  test("grows short drafts but caps long drafts for internal scrolling", () => {
    expect(boundedComposerHeight(72)).toBe(72);
    expect(boundedComposerHeight(1200)).toBe(MESSAGE_COMPOSER_MAX_HEIGHT_PX);
  });

  test("fails closed for invalid or negative measurements", () => {
    expect(boundedComposerHeight(-20)).toBe(0);
    expect(boundedComposerHeight(Number.NaN)).toBe(0);
    expect(boundedComposerHeight(1200, -1)).toBe(0);
  });
});

test("drafts leave room for history above a mobile keyboard", () => {
  expect(composerHeightLimit(844)).toBe(160);
  expect(composerHeightLimit(400)).toBe(100);
  expect(composerHeightLimit(240)).toBe(60);
  expect(composerHeightLimit(120)).toBe(44);
});
