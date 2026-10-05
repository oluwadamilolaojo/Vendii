/**
 * The app was called Dividendi before Vendii, and browser storage keys carried that prefix.
 * Move them over once so nobody loses a half-finished claim or gets signed out by the rename.
 * Imported for its side effect by every module that reads storage. Safe to run repeatedly.
 */
const LEGACY = "dividendi:";
const CURRENT = "vendii:";

function migrate() {
  if (typeof window === "undefined") return;
  try {
    const ls = window.localStorage;
    for (const k of Object.keys(ls)) {
      if (!k.startsWith(LEGACY)) continue;
      const next = CURRENT + k.slice(LEGACY.length);
      if (ls.getItem(next) === null) ls.setItem(next, ls.getItem(k) ?? "");
      ls.removeItem(k);
    }
  } catch {
    /* storage blocked or full: nothing to migrate */
  }
}

migrate();
export {};
