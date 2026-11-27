import { lazy } from "react";

import type { ComponentType, ReactNode } from "react";

/**
 * One place that knows which module backs which route.
 *
 * The route table has to be renderable three ways: eagerly on the server (a
 * lazy component cannot resolve inside renderToString, it just renders its
 * fallback), lazily on the client so each page is still its own chunk, and --
 * for the route the visitor actually landed on -- already resolved, because
 * hydrating a Suspense boundary whose content is not ready makes React throw
 * the server's markup away and render the fallback. That last case is the
 * whole point of prerendering, so it is the one that must not be got wrong.
 */
export interface RoutePages {
  Home: ComponentType;
  Rooms: ComponentType;
  Chat: ComponentType;
  TOS: ComponentType;
  Privacy: ComponentType;
  SessionLab: ComponentType;
  Guide: ComponentType<{
    page: "protocol" | "roadmap" | "whitepaper" | "wallet/help";
  }>;
  Explorer: ComponentType<{ page: "overview" | "testnet" | "mainnet" }>;
  Blog: ComponentType;
  BlogPost: ComponentType;
  ChatLayout: ComponentType;
  RoomProviders: ComponentType<{ children: ReactNode }>;
}

export type PageKey = keyof RoutePages;

export const loaders: {
  [K in PageKey]: () => Promise<{ default: RoutePages[K] }>;
} = {
  Home: () => import("./home"),
  Rooms: () => import("./rooms"),
  Chat: () => import("./chat"),
  TOS: () => import("./tos"),
  Privacy: () => import("./privacy"),
  SessionLab: () => import("./session-lab"),
  Guide: () => import("./guide"),
  Explorer: () => import("./explorer"),
  Blog: () => import("./blog"),
  BlogPost: () => import("./blog-post"),
  ChatLayout: () => import("../components/custom/ChatLayout"),
  RoomProviders: () => import("../components/custom/RoomProviders"),
};

const KEYS = Object.keys(loaders) as PageKey[];

export const lazyPages: RoutePages = Object.fromEntries(
  // The cast is at the boundary of a map whose value type varies per key;
  // RoutePages above is the checked shape everything else uses.
  KEYS.map((key) => [
    key,
    lazy(loaders[key] as () => Promise<{ default: ComponentType }>),
  ]),
) as unknown as RoutePages;

/**
 * The pages a given path renders, so the client can resolve exactly those
 * before hydrating and no more. The room routes render a layout around their
 * page, hence more than one.
 */
export const pagesForPath = (rawPathname: string): PageKey[] => {
  // Trailing slashes are the host's business, not the route table's: a static
  // host serving /blog/ made this match the /blog/ prefix and resolve the post
  // page for the index, so the wrong chunk was fetched and the right one was
  // still lazy at hydration.
  const pathname =
    rawPathname.length > 1 ? rawPathname.replace(/\/+$/u, "") : rawPathname;
  if (pathname === "/" || pathname === "") return ["Home"];
  if (pathname.startsWith("/blog/")) return ["BlogPost"];
  if (
    ["/protocol", "/roadmap", "/whitepaper", "/wallet/help"].includes(pathname)
  )
    return ["Guide"];
  if (
    ["/explorer", "/explorer/testnet", "/explorer/mainnet"].includes(pathname)
  )
    return ["Explorer"];
  if (pathname === "/blog") return ["Blog"];
  if (pathname === "/privacy-policy") return ["Privacy"];
  if (pathname === "/terms-of-service") return ["TOS"];
  if (pathname === "/session-lab") return ["SessionLab"];
  if (pathname === "/rooms") return ["RoomProviders", "ChatLayout", "Rooms"];
  if (pathname === "/r") return ["RoomProviders", "ChatLayout", "Chat"];
  // Unknown paths render the landing page, same as the route table's catch-all.
  return ["Home"];
};

/** Resolve the given pages, leaving every other route lazy. */
export const resolvePages = async (keys: PageKey[]): Promise<RoutePages> => {
  const resolved = await Promise.all(
    keys.map(async (key) => [key, (await loaders[key]()).default] as const),
  );
  return { ...lazyPages, ...Object.fromEntries(resolved) } as RoutePages;
};
