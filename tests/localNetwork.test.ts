import { expect, test } from "bun:test";
import { createLocalNetworkAccess } from "../src/protocol/localNetwork";

const bridge = (allowed: boolean) => {
  let calls = 0;
  let settings = 0;
  return {
    beginRoom: async () => {
      calls++;
      return { allowed };
    },
    currentAccess: async () => ({ allowed }),
    openSettings: async () => {
      settings++;
    },
    update: (value: boolean) => {
      allowed = value;
    },
    calls: () => calls,
    settings: () => settings,
  };
};

test.each(["web", "ios"])(
  "%s room launches have no Android permission calls",
  async (platform) => {
    const native = bridge(false);
    const access = createLocalNetworkAccess(() => platform, native);
    await access.beginRoom();
    await access.refresh();
    expect(native.calls()).toBe(0);
    expect(access.denied()).toBe(false);
  },
);

test("overlapping joins share one native request; a denial permits connection and offers settings", async () => {
  const native = bridge(false);
  const access = createLocalNetworkAccess(() => "android", native);
  const states: boolean[] = [];
  const done = access.subscribe(() => states.push(access.denied()));
  await Promise.all([access.beginRoom(), access.beginRoom()]);
  expect(native.calls()).toBe(1);
  expect(states).toEqual([true]);
  await access.openSettings();
  expect(native.settings()).toBe(1);
  native.update(true);
  await access.refresh();
  expect(states).toEqual([true, false]);
  native.update(false);
  await access.refresh();
  expect(states).toEqual([true, false, true]);
  done();
});
