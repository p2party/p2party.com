import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The entry points into identity backup and restore, checked at the source.
 *
 * There is no DOM test harness in this app -- every other test here covers a
 * pure module -- so rendering the menus is not on the table. What is worth
 * pinning anyway is structural, and all of it is invisible to the type checker:
 *
 *  - the two layouts must offer the same two actions under the same words,
 *    because they are the same feature reached from a phone and from a desktop;
 *  - the dialogs must not be mounted inside the menu, because a Headless UI
 *    menu unmounts its panel as it closes and would take an open dialog with
 *    it; and
 *  - each mount must remount on open and close, which is what keeps a recovery
 *    phrase from outliving the panel that showed it. That one is a security
 *    property, it is documented on both dialogs' props, and moving a mount is
 *    exactly how it gets dropped.
 */
const componentsRoot = join(import.meta.dir, "..", "src", "components");

const readComponent = (...parts: string[]): string =>
  readFileSync(join(componentsRoot, ...parts), "utf8");

/** The sidebar is the desktop chrome and the phone's drawer; the navbar is the
 * phone's top bar. Both are reachable without leaving the room, so both carry
 * the entry points. */
const LAYOUTS = ["Side", "Nav"] as const;

const ENTRY_LABELS = ["Back up identity", "Restore identity"] as const;

const IDENTITY_ALERTS = [
  "IdentityBackupAlert",
  "RestoreIdentityAlert",
] as const;

/** The opening JSX tag of an element, props included. */
const mountOf = (source: string, tag: string): string => {
  const start = source.indexOf(`<${tag}`);
  if (start === -1) return "";
  const end = source.indexOf("/>", start);
  return end === -1 ? source.slice(start) : source.slice(start, end);
};

describe("identity backup and restore entry points", () => {
  test.each(LAYOUTS)(
    "%s offers both actions in one identity menu",
    (layout) => {
      const menu = readComponent(layout, "IdentityDropdown.tsx");

      for (const label of ENTRY_LABELS) expect(menu).toContain(label);
    },
  );

  test.each(LAYOUTS)("%s keeps recovery out of the delete menu", (layout) => {
    const deleteMenu = readComponent(layout, "DeleteDropdown.tsx");

    // Backing an identity up is not a way of destroying it, and the row
    // above it purges the identity for good. Sharing a menu with that is a
    // mis-tap waiting to happen.
    for (const label of ENTRY_LABELS) expect(deleteMenu).not.toContain(label);
  });

  test.each(LAYOUTS)(
    "%s mounts both dialogs outside the menu that opens them",
    (layout) => {
      const menu = readComponent(layout, "IdentityDropdown.tsx");
      const chrome = readComponent(layout, "index.tsx");

      for (const alert of IDENTITY_ALERTS) {
        expect(menu).not.toContain(alert);
        expect(mountOf(chrome, alert)).not.toBe("");
      }
    },
  );

  test.each(LAYOUTS)(
    "%s remounts both dialogs on every open and close",
    (layout) => {
      const chrome = readComponent(layout, "index.tsx");

      expect(mountOf(chrome, "IdentityBackupAlert")).toContain(
        "key={`backup-${String(showIdentityBackup)}`}",
      );
      expect(mountOf(chrome, "RestoreIdentityAlert")).toContain(
        "key={`restore-${String(showIdentityRestore)}`}",
      );
    },
  );

  test.each(LAYOUTS)(
    "%s hides the entries when the build cannot back up",
    (layout) => {
      // A vendored build from before the identity backup API would show a menu
      // whose every item throws.
      expect(readComponent(layout, "index.tsx")).toContain(
        "identityBackupIsAvailable",
      );
    },
  );
});
