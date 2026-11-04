import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUTE_ALIASES, aliasRouteTarget } from "./routeAliases";
import { accountAuthTab } from "./hashQuery";

test("aliases rewrite to the real page", () => {
  assert.equal(aliasRouteTarget("/login"), "/account?tab=signin");
  assert.equal(aliasRouteTarget("/signup"), "/account?tab=signup");
  assert.equal(aliasRouteTarget("/today"), "/");
  assert.equal(aliasRouteTarget("/login/"), "/account?tab=signin", "trailing slash");
  assert.equal(aliasRouteTarget("/LOGIN"), "/account?tab=signin", "case");
});

test("the rewritten tab is one Account understands", () => {
  assert.equal(accountAuthTab(new URLSearchParams(aliasRouteTarget("/login")!.split("?")[1]).get("tab")), "signin");
  assert.equal(accountAuthTab(new URLSearchParams(aliasRouteTarget("/signup")!.split("?")[1]).get("tab")), "signup");
});

test("the visitor's query and fragment survive; their tab wins", () => {
  assert.equal(aliasRouteTarget("/login", "?next=%2Fclasses"), "/account?next=%2Fclasses&tab=signin");
  assert.equal(aliasRouteTarget("/login", "?tab=reset"), "/account?tab=reset");
  assert.equal(aliasRouteTarget("/today", "?ref=email", "#plan"), "/?ref=email#plan");
  assert.equal(aliasRouteTarget("/today", "", "#"), "/");
});

test("real pages and look-alikes are not aliases", () => {
  for (const path of ["/", "/account", "/classes/login", "/login/extra", "/logins", "/api/login"]) {
    assert.equal(aliasRouteTarget(path), null, path);
  }
  assert.deepEqual(Object.keys(ROUTE_ALIASES).sort(), ["/login", "/signup", "/today"]);
});
