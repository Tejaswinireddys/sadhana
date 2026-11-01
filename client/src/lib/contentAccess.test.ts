import { test } from "node:test";
import assert from "node:assert/strict";
import React, { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { ContentAccessGate } from "../components/ContentAccessGate";
import { PracticeProvider } from "../context/PracticeContext";
import { ASANAS, PATHWAYS } from "../data/content";

// tsx uses classic JSX for the existing components in this Node-only renderer.
Object.assign(globalThis, { React });

function renderGate(path: string, plan: string | null | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: async () => ({ user: null, deviceRows: 0 }) } } });
  if (plan !== undefined) client.setQueryData(["/api/auth/me"], {
    user: plan ? { plan } : null, deviceRows: 0,
  });
  const result = renderToString(h(QueryClientProvider, { client },
    h(Router, { hook: () => [path, () => {}] },
      h(PracticeProvider, null,
        h(ContentAccessGate, null, h("p", null, "Protected lesson")),
      ),
    ),
  ));
  client.clear();
  return result;
}

test("detail gates block guests/free users, wait for auth, and admit Plus users", () => {
  ASANAS[0].isPlus = true;
  PATHWAYS[0].isPlus = true;
  try {
    for (const path of [`/asanas/${ASANAS[0].slug}`, `/asanas/${ASANAS[0].slug}/`, `/pathways/${PATHWAYS[0].slug}`, "/instructor"]) {
      for (const plan of [null, "free", "coach"]) {
        const html = renderGate(path, plan);
        assert.match(html, /plus-upgrade-screen/);
        assert.doesNotMatch(html, /Protected lesson/);
      }
      assert.match(renderGate(path, undefined), /Checking access/);
      assert.doesNotMatch(renderGate(path, undefined), /Protected lesson/);
      assert.match(renderGate(path, "plus"), /Protected lesson/);
      assert.match(renderGate("/plus", "free"), /Protected lesson/);
    }
  } finally {
    ASANAS[0].isPlus = false;
    PATHWAYS[0].isPlus = false;
  }
  assert.match(renderGate(`/asanas/${ASANAS[0].slug}`, null), /Protected lesson/);
});

test("restored queues and program provenance cannot bypass the gate", () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const saved = { poses: [{ slug: ASANAS[0].slug }], meta: { pathwaySlug: null } };
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: { getItem: () => JSON.stringify(saved) },
  });
  try {
    ASANAS[0].isPlus = true;
    for (const path of ["/guided", "/practice", "/guided/"]) {
      assert.match(renderGate(path, "free"), /plus-upgrade-screen/);
      assert.match(renderGate(path, "plus"), /Protected lesson/);
    }
    ASANAS[0].isPlus = false;
    PATHWAYS[0].isPlus = true;
    Object.assign(saved.meta, { pathwaySlug: PATHWAYS[0].slug });
    assert.match(renderGate("/guided", "free"), /plus-upgrade-screen/);
    assert.match(renderGate("/guided", "plus"), /Protected lesson/);
  } finally {
    ASANAS[0].isPlus = false;
    PATHWAYS[0].isPlus = false;
    if (prior) Object.defineProperty(globalThis, "sessionStorage", prior);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
