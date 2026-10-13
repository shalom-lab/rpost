import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

function harness(fetchImpl, allowedUsers = ["shalom-lab"]) {
  const source = fs.readFileSync(new URL("../src/lib/github.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const storage = new Map();
  const context = {
    exports: {},
    require: () => ({ allowedGitHubUsers: allowedUsers }),
    fetch: fetchImpl,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    window: { dispatchEvent() {} },
    Event,
  };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

const settings = { pat: "test-only-token", repoFull: "shalom-lab/r-post" };

function okUserThenContent(login = "shalom-lab") {
  return async (url) => {
    if (String(url).endsWith("/user")) {
      return { ok: true, status: 200, json: async () => ({ login }) };
    }
    return {
      ok: true,
      status: 200,
      text: async () => '{"articles":[],"updatedAt":"t"}',
    };
  };
}

test("missing token blocks without a network request", async () => {
  const api = harness(() => {
    throw new Error("Unexpected request");
  });
  const result = await api.probeGitHubAccess({ ...settings, pat: "  " });
  assert.equal(result.ok, false);
  assert.match(result.message, /请先填写/);
});

test("invalid authentication blocks reading", async () => {
  for (const status of [401, 403, 429, 500]) {
    const api = harness(async () => ({ ok: false, status }));
    assert.equal((await api.probeGitHubAccess(settings)).ok, false);
  }
});

test("valid token for a different account cannot unlock content", async () => {
  const api = harness(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ login: "someone-else" }),
  }));
  assert.equal((await api.probeGitHubAccess(settings)).ok, false);
});

test("allowlisted identity must also read content/index.json", async () => {
  let sawContent = false;
  const api = harness(async (url, options) => {
    if (String(url).endsWith("/user")) {
      assert.equal(options.headers.Authorization, "Bearer test-only-token");
      return { ok: true, status: 200, json: async () => ({ login: "Shalom-Lab" }) };
    }
    sawContent = true;
    assert.match(String(url), /\/contents\/content\/index\.json$/);
    return { ok: true, status: 200, text: async () => "{}" };
  });
  assert.equal((await api.probeGitHubAccess(settings)).ok, true);
  assert.equal(sawContent, true);
});

test("empty policy denies access", async () => {
  const api = harness(() => {
    throw new Error("Unexpected request");
  }, []);
  assert.equal((await api.probeGitHubAccess(settings)).ok, false);
});

test("changing or removing a saved token cannot reuse a previous validation", async () => {
  const api = harness(async (url, options) => {
    if (options.headers.Authorization !== "Bearer test-only-token") {
      return { ok: false, status: 401 };
    }
    return okUserThenContent()(url);
  });
  api.saveSettings(settings);
  assert.equal((await api.probeGitHubAccess()).ok, true);
  api.saveSettings({ ...settings, pat: "invalid-test-token" });
  assert.equal((await api.probeGitHubAccess()).ok, false);
  api.saveSettings({ ...settings, pat: "" });
  assert.equal((await api.probeGitHubAccess()).ok, false);
});
