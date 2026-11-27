import { Capacitor, registerPlugin } from "@capacitor/core";

interface LocalNetworkPlugin {
  beginRoom(): Promise<{ allowed: boolean }>;
  currentAccess(): Promise<{ allowed: boolean }>;
  openSettings(): Promise<void>;
}

const plugin = registerPlugin<LocalNetworkPlugin>("RoomLocalNetwork");

export function createLocalNetworkAccess(
  platform: () => string,
  native: LocalNetworkPlugin,
) {
  let denied = false;
  let inFlight: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const report = ({ allowed }: { allowed: boolean }) => {
    if (denied === !allowed) return;
    denied = !allowed;
    for (const listener of listeners) listener();
  };

  return {
    denied: () => denied,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async beginRoom() {
      if (platform() !== "android") return;
      inFlight ??= native
        .beginRoom()
        .then(report)
        .finally(() => {
          inFlight = undefined;
        });
      await inFlight;
    },
    async refresh() {
      if (platform() !== "android") return;
      if (inFlight) await inFlight;
      else report(await native.currentAccess());
    },
    openSettings: () => native.openSettings(),
  };
}

export const localNetwork = createLocalNetworkAccess(
  () => Capacitor.getPlatform(),
  plugin,
);
