import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Dividendi to Vendii storage migration", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const ls = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() { return store.size; },
    };
    // Object.keys(localStorage) lists stored keys in browsers; mimic that.
    const proxy = new Proxy(ls, { ownKeys: () => [...store.keys()], getOwnPropertyDescriptor: (_t, k) => (store.has(String(k)) ? { enumerable: true, configurable: true, value: store.get(String(k)) } : undefined) });
    vi.stubGlobal("window", { localStorage: proxy });
    vi.resetModules();
  });

  it("moves old keys to the new prefix and keeps their values", async () => {
    window.localStorage.setItem("dividendi:v1:draft", '{"name":"x"}');
    window.localStorage.setItem("dividendi:v1:session", "s");
    await import("@/lib/storageMigration");
    expect(window.localStorage.getItem("vendii:v1:draft")).toBe('{"name":"x"}');
    expect(window.localStorage.getItem("vendii:v1:session")).toBe("s");
    expect(window.localStorage.getItem("dividendi:v1:draft")).toBeNull();
  });

  it("never overwrites data already saved under the new name", async () => {
    window.localStorage.setItem("vendii:v1:draft", "new");
    window.localStorage.setItem("dividendi:v1:draft", "old");
    await import("@/lib/storageMigration");
    expect(window.localStorage.getItem("vendii:v1:draft")).toBe("new");
  });
});
