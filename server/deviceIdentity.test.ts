import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import {
  deviceProof,
  encodeDeviceCookie,
  resolveDeviceOwner,
  verifyDeviceProof,
} from "./owner";

const A = "0d88a891-1111-4111-8111-111111111111";
const B = "5eb5824d-2222-4222-8222-222222222222";

function fakeReq(opts: { header?: string; proof?: string; cookie?: string }): Request {
  return {
    get: (name: string) => {
      const n = name.toLowerCase();
      if (n === "x-device-id") return opts.header;
      if (n === "x-device-proof") return opts.proof;
      return undefined;
    },
    headers: { cookie: opts.cookie },
  } as unknown as Request;
}

function fakeRes() {
  const setCookies: string[] = [];
  const headers: Record<string, string> = {};
  const res = {
    append: (name: string, value: string) => {
      if (name === "Set-Cookie") setCookies.push(value);
      if (name === "Access-Control-Expose-Headers") {
        headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
      }
    },
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  } as unknown as Response;
  return { res, setCookies, headers };
}

function cookieValue(setCookies: string[]): string | undefined {
  const line = setCookies.find((c) => c.startsWith("sadhana_device="));
  return line ? decodeURIComponent(line.split(";")[0]!.split("=")[1]!) : undefined;
}

describe("resolveDeviceOwner", () => {
  it("recovers the owner from the signed cookie when localStorage was evicted", () => {
    const { res, setCookies } = fakeRes();
    const id = resolveDeviceOwner(
      fakeReq({ cookie: `sadhana_device=${encodeURIComponent(encodeDeviceCookie(A))}` }),
      res,
    );
    assert.equal(id, A);
    assert.equal(setCookies.length, 0, "should not re-issue an unchanged signed cookie");
  });

  it("ignores a mismatched header when a valid cookie is present (IDOR guard)", () => {
    // Attacker with cookie A must not read B's data by replaying B's UUID.
    const { res, setCookies, headers } = fakeRes();
    const id = resolveDeviceOwner(
      fakeReq({
        header: B,
        proof: deviceProof(B),
        cookie: `sadhana_device=${encodeURIComponent(encodeDeviceCookie(A))}`,
      }),
      res,
    );
    assert.equal(id, A, "cookie is authoritative — header must not swap owners");
    assert.equal(headers["X-Device-Id"], A);
    assert.equal(setCookies.length, 0);
  });

  it("adopts a header+proof pair when there is no cookie (recovery path)", () => {
    const { res, setCookies, headers } = fakeRes();
    const id = resolveDeviceOwner(fakeReq({ header: A, proof: deviceProof(A) }), res);
    assert.equal(id, A);
    assert.equal(cookieValue(setCookies), encodeDeviceCookie(A));
    assert.equal(headers["X-Device-Proof"], deviceProof(A));
  });

  it("rejects a bare header UUID without proof when legacy mode is off", () => {
    const prev = process.env.ALLOW_LEGACY_DEVICE_HEADER;
    const prevNode = process.env.NODE_ENV;
    process.env.ALLOW_LEGACY_DEVICE_HEADER = "0";
    process.env.NODE_ENV = "production";
    try {
      const { res, setCookies } = fakeRes();
      const id = resolveDeviceOwner(fakeReq({ header: A }), res);
      assert.notEqual(id, A, "forged/replayed UUID without proof must not be adopted");
      assert.match(id, /^[0-9a-f-]{36}$/);
      assert.ok(cookieValue(setCookies)?.startsWith("v1."));
    } finally {
      if (prev === undefined) delete process.env.ALLOW_LEGACY_DEVICE_HEADER;
      else process.env.ALLOW_LEGACY_DEVICE_HEADER = prev;
      if (prevNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNode;
    }
  });

  it("mints and persists a signed id when the browser has neither", () => {
    const { res, setCookies, headers } = fakeRes();
    const id = resolveDeviceOwner(fakeReq({}), res);
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.equal(cookieValue(setCookies), encodeDeviceCookie(id));
    assert.equal(headers["X-Device-Proof"], deviceProof(id));
  });

  it("ignores a malformed header rather than trusting it", () => {
    const { res } = fakeRes();
    const id = resolveDeviceOwner(
      fakeReq({
        header: "not-a-uuid",
        cookie: `sadhana_device=${encodeURIComponent(encodeDeviceCookie(A))}`,
      }),
      res,
    );
    assert.equal(id, A);
  });

  it("upgrades a legacy bare-uuid cookie to the signed form", () => {
    const { res, setCookies } = fakeRes();
    const id = resolveDeviceOwner(fakeReq({ cookie: `sadhana_device=${A}` }), res);
    assert.equal(id, A);
    assert.equal(cookieValue(setCookies), encodeDeviceCookie(A));
  });

  it("issues the cookie as HttpOnly with a long life", () => {
    const { res, setCookies } = fakeRes();
    resolveDeviceOwner(fakeReq({}), res);
    const line = setCookies.find((c) => c.startsWith("sadhana_device="))!;
    assert.match(line, /HttpOnly/);
    assert.match(line, /SameSite=Lax/);
    assert.match(line, /Max-Age=34560000/);
  });

  it("verifies device proofs with a timing-safe compare", () => {
    const proof = deviceProof(A);
    assert.equal(verifyDeviceProof(A, proof), true);
    assert.equal(verifyDeviceProof(A, "nope"), false);
    assert.equal(verifyDeviceProof(B, proof), false);
  });
});
