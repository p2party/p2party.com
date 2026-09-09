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

/** Keep history visible even with a keyboard open in landscape. */
export const composerHeightLimit = (availableHeight: number): number =>
  Number.isFinite(availableHeight)
    ? Math.max(
        44,
        Math.min(MESSAGE_COMPOSER_MAX_HEIGHT_PX, availableHeight / 4),
      )
    : MESSAGE_COMPOSER_MAX_HEIGHT_PX;
