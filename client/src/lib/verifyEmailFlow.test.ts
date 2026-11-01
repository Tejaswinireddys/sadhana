import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyVerifyError, forgetVerifyAttempt, verifyOnce } from "./verifyEmailFlow";

afterEach(() => forgetVerifyAttempt());

describe("classifyVerifyError", () => {
  it("treats a refused token as invalid — a new email is the only way out", () => {
    assert.equal(classifyVerifyError(new Error('400: {"error":"Verification code is invalid or expired"}')), "invalid");
    assert.equal(classifyVerifyError(new Error("404: Not found")), "invalid");
  });

  it("offers a retry for network, timeout, rate-limit and server failures", () => {
    assert.equal(classifyVerifyError(new TypeError("Failed to fetch")), "retry");
    assert.equal(classifyVerifyError(new Error("Request timed out. Check your connection and try again.")), "retry");
    assert.equal(classifyVerifyError(new Error("429: Too many requests")), "retry");
    assert.equal(classifyVerifyError(new Error("503: Service Unavailable")), "retry");
    assert.equal(classifyVerifyError("weird"), "retry");
  });
});

describe("verifyOnce", () => {
  it("sends one request per token even when called twice (StrictMode double effect)", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const request = async () => { calls++; await gate; return { ok: true } as const; };
    const first = verifyOnce("tok-1", request);
    const second = verifyOnce("tok-1", request);
    release();
    assert.deepEqual(await first, { ok: true });
    assert.deepEqual(await second, { ok: true });
    assert.equal(calls, 1);
  });

  it("a remount after success sees the success, not a consumed-token failure", async () => {
    let calls = 0;
    const consumeOnce = async () => {
      calls++;
      if (calls > 1) throw new Error('400: {"error":"Verification code is invalid or expired"}');
      return "signed-in";
    };
    assert.equal(await verifyOnce("tok-2", consumeOnce), "signed-in");
    assert.equal(await verifyOnce("tok-2", consumeOnce), "signed-in");
    assert.equal(calls, 1);
  });

  it("keeps an invalid outcome but forgets a network failure so Try again re-sends", async () => {
    let calls = 0;
    const invalid = async () => { calls++; throw new Error("400: expired"); };
    await assert.rejects(verifyOnce("tok-3", invalid));
    await assert.rejects(verifyOnce("tok-3", invalid));
    assert.equal(calls, 1);

    let attempts = 0;
    const flaky = async () => {
      attempts++;
      if (attempts === 1) throw new TypeError("Failed to fetch");
      return "ok";
    };
    await assert.rejects(verifyOnce("tok-4", flaky));
    assert.equal(await verifyOnce("tok-4", flaky), "ok");
    assert.equal(attempts, 2);
  });

  it("different tokens are independent", async () => {
    let calls = 0;
    const request = async () => ++calls;
    await verifyOnce("a", request);
    await verifyOnce("b", request);
    assert.equal(calls, 2);
  });
});
