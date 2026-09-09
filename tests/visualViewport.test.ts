import { afterEach, expect, test } from "bun:test";
import { installVisualViewportTracking } from "../src/hooks/useVisualViewport";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(
  globalThis,
  "document",
);
let dispose = () => {};
afterEach(() => {
  dispose();
  for (const [key, descriptor] of [
    ["window", originalWindow],
    ["document", originalDocument],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function fixture() {
  const values = new Map<string, string>();
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const viewport = Object.assign(new EventTarget(), {
    height: 844,
    width: 390,
    offsetTop: 0,
    offsetLeft: 0,
    scale: 1,
  });
  const win = Object.assign(new EventTarget(), {
    visualViewport: viewport,
    innerHeight: 844,
    innerWidth: 390,
    requestAnimationFrame(callback: FrameRequestCallback) {
      callbacks.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame(id: number) {
      callbacks.delete(id);
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: win,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: {
        style: {
          getPropertyValue: (name: string) => values.get(name) ?? "",
          setProperty: (name: string, value: string) => values.set(name, value),
          removeProperty: (name: string) => values.delete(name),
        },
      },
    },
  });
  return {
    values,
    viewport,
    win,
    callbacks,
    flush() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(0));
    },
  };
}

test("keyboard shrink and Safari pan share one update and restore on dismissal", () => {
  const f = fixture();
  dispose = installVisualViewportTracking();
  Object.assign(f.viewport, { height: 380, offsetTop: 100, offsetLeft: 4 });
  f.viewport.dispatchEvent(new Event("resize"));
  f.viewport.dispatchEvent(new Event("scroll"));
  f.win.dispatchEvent(new Event("resize"));
  expect(f.callbacks.size).toBe(1);
  f.flush();
  expect(f.values.get("--app-viewport-height")).toBe("380px");
  expect(f.values.get("--app-viewport-top")).toBe("100px");
  expect(f.values.get("--app-viewport-left")).toBe("4px");
  expect(f.values.get("--app-viewport-bottom-occlusion")).toBe("364px");
  Object.assign(f.viewport, { height: 844, offsetTop: 0, offsetLeft: 0 });
  f.viewport.dispatchEvent(new Event("resize"));
  f.flush();
  expect(f.values.get("--app-viewport-height")).toBe("844px");
  expect(f.values.get("--app-viewport-top")).toBe("0px");
  expect(f.values.get("--app-viewport-bottom-occlusion")).toBe("0px");
});

test("pinch zoom leaves the existing layout available for native panning", () => {
  const f = fixture();
  dispose = installVisualViewportTracking();
  const before = [...f.values];
  Object.assign(f.viewport, {
    scale: 2,
    width: 195,
    height: 422,
    offsetLeft: 80,
  });
  f.viewport.dispatchEvent(new Event("resize"));
  f.flush();
  expect([...f.values]).toEqual(before);
});

test("cleanup cancels pending updates, removes listeners, and restores prior styles", () => {
  const f = fixture();
  f.values.set("--app-viewport-height", "100dvh");
  dispose = installVisualViewportTracking();
  f.viewport.dispatchEvent(new Event("resize"));
  dispose();
  dispose = () => {};
  expect(f.callbacks.size).toBe(0);
  expect([...f.values]).toEqual([["--app-viewport-height", "100dvh"]]);
  f.viewport.dispatchEvent(new Event("scroll"));
  f.win.dispatchEvent(new Event("pageshow"));
  expect(f.callbacks.size).toBe(0);
});
