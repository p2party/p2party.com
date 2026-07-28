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

/**
 * Keep a long draft from consuming the message viewport. 160px is roughly six
 * lines with the current mobile textarea metrics; after that the draft becomes
 * its own scroll owner, as in conventional chat composers.
 */
export const MESSAGE_COMPOSER_MAX_HEIGHT_PX = 160;

export const boundedComposerHeight = (
  contentHeight: number,
  maxHeight = MESSAGE_COMPOSER_MAX_HEIGHT_PX,
): number => {
  if (!Number.isFinite(contentHeight) || !Number.isFinite(maxHeight)) return 0;
  return Math.min(Math.max(0, contentHeight), Math.max(0, maxHeight));
};
