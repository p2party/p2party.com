import { useEffect } from "react";

/** One measurement shared by the room shell and portalled dialogs. */
export function installVisualViewportTracking() {
  if (typeof window === "undefined") return () => {};
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const properties = [
    "--app-viewport-height",
    "--app-viewport-width",
    "--app-viewport-top",
    "--app-viewport-left",
    "--app-viewport-bottom-occlusion",
  ];
  const previous = properties.map((name) => root.style.getPropertyValue(name));
  let frame = 0;

  const update = () => {
    frame = 0;
    // Let native pinch zoom pan the existing layout. Reflowing to the zoomed
    // width or chasing its offsets makes magnified controls move away.
    if (viewport && viewport.scale > 1.01) return;
    const values = [
      viewport?.height ?? window.innerHeight,
      viewport?.width ?? window.innerWidth,
      viewport?.offsetTop ?? 0,
      viewport?.offsetLeft ?? 0,
      // A keyboard can cover the home-indicator area. Reserve only the safe
      // area that is still visible, rather than an empty strip above it.
      viewport ? window.innerHeight - viewport.height - viewport.offsetTop : 0,
    ];
    values.forEach((value, index) => {
      if (Number.isFinite(value) && (index > 1 || value > 0))
        root.style.setProperty(properties[index], `${Math.max(0, value)}px`);
    });
  };
  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };
  update();
  window.addEventListener("resize", schedule);
  window.addEventListener("pageshow", schedule);
  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);

  return () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("pageshow", schedule);
    viewport?.removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
    properties.forEach((name, index) => {
      if (previous[index]) root.style.setProperty(name, previous[index]);
      else root.style.removeProperty(name);
    });
  };
}

/** Mount once at the application boundary, outside route/dialog lifecycles. */
export function useVisualViewport() {
  useEffect(installVisualViewportTracking, []);
}
