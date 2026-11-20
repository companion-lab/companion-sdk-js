// definePlugin and useSettingsState — the only runtime exports of the SDK.
// Both read globalThis.__companion_host__ (definePlugin not at all), so the
// tests stub that global directly (window-prefs.test.ts stubGlobal
// convention).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { definePlugin, useSettingsState } from "./index";

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("definePlugin", () => {
  it("wraps an activation function as { activate }", () => {
    const activate = (ctx: unknown) => void ctx;
    const plugin = definePlugin(activate);
    expect(plugin).toEqual({ activate });
    expect(plugin.activate).toBe(activate);
  });

  it("passes the ctx through untouched at activation time", async () => {
    const seen: unknown[] = [];
    const plugin = definePlugin((ctx) => void seen.push(ctx));
    const ctx = { id: "demo" };
    await plugin.activate(ctx as never);
    expect(seen).toEqual([ctx]);
  });

  it("accepts async activation functions", async () => {
    let ran = false;
    const plugin = definePlugin(async () => {
      ran = true;
    });
    await plugin.activate({} as never);
    expect(ran).toBe(true);
  });
});

describe("useSettingsState", () => {
  it("throws outside any host", () => {
    expect(() => useSettingsState()).toThrow(
      "useSettingsState is only available inside the settings window",
    );
  });

  it("throws when the host has no settings surface", () => {
    vi.stubGlobal("__companion_host__", { React: {} });
    expect(() => useSettingsState()).toThrow(
      "useSettingsState is only available inside the settings window",
    );
  });

  it("forwards to the host's hook and returns its value", () => {
    const hostHook = vi.fn(() => ({ persona: "Sakura" }));
    vi.stubGlobal("__companion_host__", {
      React: {},
      settings: { useSettingsState: hostHook },
    });
    expect(useSettingsState()).toEqual({ persona: "Sakura" });
    expect(hostHook).toHaveBeenCalledTimes(1);
  });
});
