export const MESSAGE_BOTTOM_THRESHOLD_PX = 96;

export interface MessageScrollGeometry {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}

/**
 * A browser can emit `scroll` while flex layout is changing the viewport.
 * When only the extents changed and scrollTop did not, that event is not reader
 * intent: ResizeObserver owns the transition and preserves the pre-resize pin.
 * A simultaneous scrollTop change is real reader movement and must win.
 */
export const isLayoutOnlyMessageScroll = (
  previous: MessageScrollGeometry,
  current: MessageScrollGeometry,
): boolean =>
  (previous.scrollHeight !== current.scrollHeight ||
    previous.clientHeight !== current.clientHeight) &&
  previous.scrollTop === current.scrollTop;

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
