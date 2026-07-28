/**
 * Distance from the composer's normal-flow bottom to the visual viewport's
 * bottom.
 *
 * A keyboard can shrink only the visual viewport while iOS Safari also pans
 * that viewport down to keep the focused control visible. `offsetTop` is part
 * of the visible bottom, so omitting it lifts the composer once for the
 * keyboard and again for the pan. The first argument is the row's layout-owned
 * bottom rather than `window.innerHeight`, so safe-area and shell padding that
 * have already been consumed are not added a second time.
 */
export const composerBottomOffset = (
  composerLayoutBottom: number,
  visualViewportHeight: number,
  visualViewportOffsetTop: number,
): number => {
  if (
    !Number.isFinite(composerLayoutBottom) ||
    !Number.isFinite(visualViewportHeight) ||
    !Number.isFinite(visualViewportOffsetTop)
  )
    return 0;

  const visibleBottom =
    Math.max(0, visualViewportHeight) + Math.max(0, visualViewportOffsetTop);
  return Math.max(0, composerLayoutBottom - visibleBottom);
};
