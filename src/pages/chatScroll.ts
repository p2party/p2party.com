export const MESSAGE_BOTTOM_THRESHOLD_PX = 96;

export interface MessageScrollGeometry {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}

/**
 * "Near bottom" is user intent, not exact pixel equality. Fractional layout,
 * touch momentum, and the final bubble's margin all make an exact comparison
 * brittle; one compact bubble of tolerance keeps the live edge sticky without
 * treating a reader browsing older history as live.
 */
export const isNearMessageBottom = (
  { scrollHeight, clientHeight, scrollTop }: MessageScrollGeometry,
  threshold = MESSAGE_BOTTOM_THRESHOLD_PX,
): boolean =>
  scrollHeight - clientHeight - Math.max(0, scrollTop) <=
  Math.max(0, threshold);
