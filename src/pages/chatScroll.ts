export const MESSAGE_BOTTOM_THRESHOLD_PX = 96;

export interface MessageScrollGeometry {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}

export interface MessageReadingAnchor {
  element: HTMLElement;
  offset: number;
}

/** Locate the visible row with logarithmic layout reads, even in long history. */
export const captureMessageReadingAnchor = (
  list: HTMLElement,
  content: HTMLElement,
): MessageReadingAnchor | null => {
  const top = list.getBoundingClientRect().top;
  const rows = content.children;
  let low = 0;
  let high = rows.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (rows[middle].getBoundingClientRect().bottom <= top) low = middle + 1;
    else high = middle;
  }
  const element = rows[low];
  return element instanceof HTMLElement
    ? { element, offset: element.getBoundingClientRect().top - top }
    : null;
};

/** Native anchoring may select text within a bubble and drift when it wraps. */
export const restoreMessageReadingAnchor = (
  list: HTMLElement,
  anchor: MessageReadingAnchor | null,
): void => {
  if (!anchor || !list.contains(anchor.element)) return;
  const offset =
    anchor.element.getBoundingClientRect().top -
    list.getBoundingClientRect().top;
  list.scrollTop += offset - anchor.offset;
};

/**
 * A browser can emit `scroll` while flex layout is changing the viewport.
 * Native scroll anchoring can change scrollTop as well as the extents when a
 * bubble finishes loading. Geometry alone therefore cannot prove reader
 * movement. ResizeObserver owns that transition unless wheel, touch, scrollbar
 * or keyboard input identifies an intentional scroll in the same frame.
 */
export const isLayoutOnlyMessageScroll = (
  previous: MessageScrollGeometry,
  current: MessageScrollGeometry,
  hasReaderScrollIntent = false,
): boolean =>
  (previous.scrollHeight !== current.scrollHeight ||
    previous.clientHeight !== current.clientHeight) &&
  !hasReaderScrollIntent;

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
