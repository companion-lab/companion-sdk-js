// Host-react shim tests. All three shims throw at module load when the host
// runtime is absent, and re-export the host's React/ReactDOMClient otherwise.
// The shims execute their guard at import time, so each test stubs
// __companion_host__ FIRST and re-imports through vi.resetModules().

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function fakeReact() {
  return {
    Fragment: Symbol("fragment"),
    createElement: vi.fn((type, props, ...children) => ({ type, props, children })),
    jsx: vi.fn(() => ({ via: "R.jsx" })),
    jsxs: vi.fn(() => ({ via: "R.jsxs" })),
    useState: vi.fn(),
    memo: vi.fn(),
  };
}

function fakeReactDOM() {
  return { createRoot: vi.fn(), flushSync: vi.fn(), hydrateRoot: vi.fn() };
}

const NOT_ACTIVATED =
  "companion plugin runtime not present: this bundle must be activated by the companion host, not loaded directly";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

afterEach(() => vi.unstubAllGlobals());

describe("react.js shim", () => {
  it("throws without a host runtime", async () => {
    await expect(import("./react.js")).rejects.toThrow(NOT_ACTIVATED);
  });

  it("throws when the host has no React", async () => {
    vi.stubGlobal("__companion_host__", {});
    await expect(import("./react.js")).rejects.toThrow(NOT_ACTIVATED);
  });

  it("re-exports the host React (default + named hooks)", async () => {
    const React = fakeReact();
    vi.stubGlobal("__companion_host__", { React });
    const mod = await import("./react.js");
    expect(mod.default).toBe(React);
    expect(mod.useState).toBe(React.useState);
    expect(mod.createElement).toBe(React.createElement);
    expect(mod.Fragment).toBe(React.Fragment);
    expect(mod.memo).toBe(React.memo);
  });
});

describe("react-dom.js shim", () => {
  it("throws without ReactDOMClient on the host", async () => {
    vi.stubGlobal("__companion_host__", { React: fakeReact() });
    await expect(import("./react-dom.js")).rejects.toThrow(NOT_ACTIVATED);
  });

  it("re-exports createRoot/flushSync/hydrateRoot from the host client", async () => {
    const ReactDOMClient = fakeReactDOM();
    vi.stubGlobal("__companion_host__", { React: fakeReact(), ReactDOMClient });
    const mod = await import("./react-dom.js");
    expect(mod.default).toBe(ReactDOMClient);
    expect(mod.createRoot).toBe(ReactDOMClient.createRoot);
    expect(mod.flushSync).toBe(ReactDOMClient.flushSync);
    expect(mod.hydrateRoot).toBe(ReactDOMClient.hydrateRoot);
  });
});

describe("jsx-runtime.js shim", () => {
  it("throws without a host runtime", async () => {
    await expect(import("./jsx-runtime.js")).rejects.toThrow(NOT_ACTIVATED);
  });

  it("prefers the host jsx-runtime when it exposes function jsx/jsxs", async () => {
    const React = fakeReact();
    const JR = { jsx: vi.fn(() => ({ via: "JR.jsx" })), jsxs: vi.fn(() => ({ via: "JR.jsxs" })) };
    vi.stubGlobal("__companion_host__", { React, JsxRuntime: JR });
    const mod = await import("./jsx-runtime.js");
    expect(mod.jsx).toBe(JR.jsx);
    expect(mod.jsxs).toBe(JR.jsxs);
    expect(mod.jsxDEV).toBe(mod.jsx);
    expect(mod.Fragment).toBe(React.Fragment);
  });

  it("falls back to React.jsx when the host has no JsxRuntime", async () => {
    const React = fakeReact();
    vi.stubGlobal("__companion_host__", { React });
    const mod = await import("./jsx-runtime.js");
    expect(mod.jsx).toBe(React.jsx);
    expect(mod.jsxs).toBe(React.jsxs);
  });

  it("falls back to React.jsx when JsxRuntime.jsx is not a function", async () => {
    const React = fakeReact();
    vi.stubGlobal("__companion_host__", { React, JsxRuntime: { jsx: null } });
    const mod = await import("./jsx-runtime.js");
    expect(mod.jsx).toBe(React.jsx);
  });

  describe("createElementWrapper fallback (no jsx anywhere)", () => {
    async function wrapperMod() {
      const React = fakeReact();
      delete React.jsx;
      delete React.jsxs;
      vi.stubGlobal("__companion_host__", { React });
      return { mod: await import("./jsx-runtime.js"), React };
    }

    it("delegates to createElement without a key", async () => {
      const { mod, React } = await wrapperMod();
      mod.jsx("div", { children: "hi" });
      expect(React.createElement).toHaveBeenCalledWith("div", { children: "hi" }, "hi");
    });

    it("injects the key into props when given", async () => {
      const { mod, React } = await wrapperMod();
      mod.jsx("div", { children: "hi" }, "k1");
      expect(React.createElement).toHaveBeenCalledWith(
        "div",
        { children: "hi", key: "k1" },
        "hi",
      );
    });

    it("jsxs routes through the same wrapper", async () => {
      const { mod, React } = await wrapperMod();
      mod.jsxs("div", { children: ["a", "b"] });
      expect(React.createElement).toHaveBeenCalledWith(
        "div",
        { children: ["a", "b"] },
        ["a", "b"],
      );
    });
  });
});
