import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { resolveDeviceOwner } from "./owner";

const A = "0d88a891-1111-4111-8111-111111111111";
const B = "5eb5824d-2222-4222-8222-222222222222";

function fakeReq(opts: { header?: string; cookie?: string }): Request {
  return {
    get: (name: string) =>
      name.toLowerCase() === "x-device-id" ? opts.header : undefined,
    headers: { cookie: opts.cookie },
  } as unknown as Request;
}

function fakeRes() {
  const setCookies: string[] = [];
  const res = {
    append: (name: string, value: string) => {
      if (name === "Set-Cookie") setCookies.push(value);
    },
  } as unknown as Response;
  return { res, setCookies };
}

function cookieValue(setCookies: string[]): string | undefined {
  const line = setCookies.find((c) => c.startsWith("sadhana_device="));
  return line ? decodeURIComponent(line.split(";")[0].split("=")[1]) : undefined;
}

describe("resolveDeviceOwner", () => {
  it("recovers the owner from the cookie when localStorage was evicted", () => {
    // The P0: clearing site data / ITP eviction used to orphan every session,
    // journal entry and streak. With no header, the cookie hands them back.
    const { res, setCookies } = fakeRes();
    const id = resolveDeviceOwner(fakeReq({ cookie: `sadhana_device=${A}` }), res);
    assert.equal(id, A);
    assert.equal(setCookies.length, 0, "should not re-issue an unchanged cookie");
  });

  it("reconciles a diverged pair by keeping the id the data lives under", () => {
    const { res, setCookies } = fakeRes();
    const id = resolveDeviceOwner(fakeReq({ header: A, cookie: `sadhana_device=${B}` }), res);
    assert.equal(id, A, "header id owns the existing data — it must win");
    assert.equal(cookieValue(setCookies), A, "cookie must be rewritten to match");
  });

  it("adopts a header-only id into a cookie so it survives eviction", () => {
    const { res, setCookies } = fakeRes();
    const id = resolveDeviceOwner(fakeReq({ header: A }), res);
    assert.equal(id, A);
    assert.equal(cookieValue(setCookies), A);
  });

  it("mints and persists an id when the browser has neither", () => {
    const { res, setCookies } = fakeRes();
    const id = resolveDeviceOwner(fakeReq({}), res);
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.equal(cookieValue(setCookies), id);
  });

  it("ignores a malformed header rather than trusting it", () => {
    const { res } = fakeRes();
    const id = resolveDeviceOwner(fakeReq({ header: "not-a-uuid", cookie: `sadhana_device=${A}` }), res);
    assert.equal(id, A);
  });

  it("issues the cookie as HttpOnly with a long life", () => {
    const { res, setCookies } = fakeRes();
    resolveDeviceOwner(fakeReq({}), res);
    const line = setCookies.find((c) => c.startsWith("sadhana_device="))!;
    assert.match(line, /HttpOnly/);
    assert.match(line, /SameSite=Lax/);
    assert.match(line, /Max-Age=34560000/);
  });
});
