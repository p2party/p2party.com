/**
 * True while the prerenderer is snapshotting this page.
 *
 * /r and /rooms are prerendered for their chrome, not their contents: the
 * sidebar, the header and the layout are identical for everyone, and shipping
 * them as static HTML is the difference between a room invite painting
 * instantly and painting after a third of a second of blank page.
 *
 * What must NOT be baked in is anything that depends on this device. The
 * prerendering browser has no saved rooms, so left alone it would snapshot
 * "0 rooms on this device" and every returning visitor would see that flash
 * before their own list replaced it. With this flag the page renders the state
 * it renders for everyone before data arrives -- its skeleton -- which is
 * exactly what a real visitor sees at that moment anyway.
 */
export const isPrerender =
  typeof window !== "undefined" && "__P2PARTY_PRERENDER__" in window;
