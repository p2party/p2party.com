import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The delete menus, checked at the source.
 *
 * There is no DOM test harness in this app, so rendering the menus is not on
 * the table. What is worth pinning is structural and invisible to the type
 * checker:
 *
 *  - a purge must never be handed straight to onClick again. React discards the
 *    promise a handler returns, and with no unhandledrejection listener and no
 *    error boundary here, that is how three destructive actions came to report
 *    neither success nor failure;
 *  - the report must be mounted outside the menu, because a Headless UI menu
 *    unmounts its panel as it closes and would take the report with it -- and
 *    the row that started the purge is gone by then in any case; and
 *  - both layouts must offer the same three actions under the same words, since
 *    they are one feature reached from a phone and from a desktop.
 */
const componentsRoot = join(import.meta.dir, "..", "src", "components");

const readComponent = (...parts: string[]): string =>
  readFileSync(join(componentsRoot, ...parts), "utf8");

/** The sidebar is the desktop chrome and the phone's drawer; the navbar is the
 * phone's top bar. Both are reachable without leaving the room. */
const LAYOUTS = ["Side", "Nav"] as const;

describe("purge reporting entry points", () => {
  test.each(LAYOUTS)("%s never hands a purge straight to onClick", (layout) => {
    const source = readComponent(layout, "DeleteDropdown.tsx");

    expect(source).not.toMatch(/onClick=\{\s*purgeIdentity\s*\}/u);
    expect(source).not.toMatch(/onClick=\{\s*purge\s*\}/u);
    // The old room row awaited inside a discarded async handler, which is the
    // same defect wearing an await.
    expect(source).not.toContain("purgeRoom(");
  });

  test.each(LAYOUTS)(
    "%s routes all three rows through one runner",
    (layout) => {
      const source = readComponent(layout, "DeleteDropdown.tsx");

      expect(source).toContain("usePurge(roomUrl)");
      expect(source).toContain('run("identity")');
      expect(source).toContain('run("room")');
      expect(source).toContain('run("everything")');
    },
  );

  test.each(LAYOUTS)("%s reports the outcome outside the menu", (layout) => {
    const source = readComponent(layout, "DeleteDropdown.tsx");
    const alert = source.indexOf("<PurgeAlert");

    expect(alert).toBeGreaterThan(-1);
    expect(alert).toBeGreaterThan(source.indexOf("</DropdownMenu>"));
    expect(alert).toBeGreaterThan(source.indexOf("</Dropdown>"));
  });

  test.each(LAYOUTS)(
    "%s only offers the room row when there is a room to name",
    (layout) => {
      // purgeRoom("") rejects on the capability, so the guard is what keeps the
      // SDK's argument check from becoming the user-facing error message.
      expect(readComponent(layout, "DeleteDropdown.tsx")).toContain(
        "roomUrl !== undefined",
      );
    },
  );

  test("both layouts offer the same three rows under the same words", () => {
    const sources = LAYOUTS.map((layout) =>
      readComponent(layout, "DeleteDropdown.tsx"),
    );

    for (const label of ["Purge Identity", "Purge Room Data", "Purge All Data"])
      for (const source of sources) expect(source).toContain(label);
  });
});
