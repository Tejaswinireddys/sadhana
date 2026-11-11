import { test } from "node:test";
import assert from "node:assert/strict";
import { connectivityView } from "./connectivity";

test("a working connection shows no banner, even if the browser says offline", () => {
  assert.equal(connectivityView({ browserOffline: true, apiDown: false }), null);
  assert.equal(connectivityView({ browserOffline: false, apiDown: false }), null);
});

test("the offline sentence needs a failed check and an offline browser", () => {
  assert.equal(connectivityView({ browserOffline: true, apiDown: true }), "offline");
  assert.equal(connectivityView({ browserOffline: false, apiDown: true }), "api");
});
