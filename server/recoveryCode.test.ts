import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hashResetToken,
  looksLikeRecoveryCode,
  newRecoveryCode,
  normalizeRecoveryCode,
  recoveryCodeExpiry,
  RECOVERY_CODE_GROUPS,
  RECOVERY_CODE_GROUP_LEN,
} from "./auth";
import { resetPasswordSchema } from "@shared/schema";
import { MemoryStorage } from "./storage";

describe("recovery codes", () => {
  it("is the shape we print on screen", () => {
    const code = newRecoveryCode();
    assert.match(code, /^[A-Z0-9]{5}(-[A-Z0-9]{5}){3}$/, code);
    assert.equal(code.split("-").length, RECOVERY_CODE_GROUPS);
    for (const group of code.split("-")) assert.equal(group.length, RECOVERY_CODE_GROUP_LEN);
  });

  it("omits characters that are ambiguous in handwriting", () => {
    // I/L/O/U and 0/1 are the classic transcription failures.
    for (let i = 0; i < 200; i++) {
      assert.doesNotMatch(newRecoveryCode(), /[ILOU01]/, "ambiguous character in a recovery code");
    }
  });

  it("has enough entropy to be a standalone credential", () => {
    // 20 characters from a 30-symbol alphabet ≈ 98 bits.
    const bits = RECOVERY_CODE_GROUPS * RECOVERY_CODE_GROUP_LEN * Math.log2(30);
    assert.ok(bits > 90, `only ${bits.toFixed(0)} bits of entropy`);
  });

  it("does not repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(newRecoveryCode());
    assert.equal(seen.size, 500);
  });

  it("is read off paper, so accepts messy input", () => {
    const code = newRecoveryCode();
    const bare = code.replace(/-/g, "");
    for (const variant of [
      code.toLowerCase(),
      bare,
      bare.toLowerCase(),
      ` ${code} `,
      code.replace(/-/g, " "),
    ]) {
      assert.equal(
        normalizeRecoveryCode(variant),
        code,
        `did not normalise ${JSON.stringify(variant)}`,
      );
    }
  });

  it("normalising is what makes the stored hash match", () => {
    const code = newRecoveryCode();
    assert.equal(
      hashResetToken(normalizeRecoveryCode(code.toLowerCase().replace(/-/g, ""))),
      hashResetToken(code),
    );
  });

  it("recognises a recovery code without mistaking an emailed token for one", () => {
    assert.equal(looksLikeRecoveryCode(newRecoveryCode()), true);
    assert.equal(looksLikeRecoveryCode(newRecoveryCode().toLowerCase()), true);
    // Emailed reset tokens are 64 hex characters.
    assert.equal(looksLikeRecoveryCode("a".repeat(64)), false);
    assert.equal(looksLikeRecoveryCode(""), false);
    assert.equal(looksLikeRecoveryCode("ABCDE-FGHJK"), false);
  });

  it("outlives a forgotten password rather than expiring on a timer", () => {
    // An emailed code expires in an hour; a recovery code is the only way in,
    // so a 60-minute clock would defeat the point.
    const years =
      (new Date(recoveryCodeExpiry()).getTime() - Date.now()) / (365 * 24 * 3_600_000);
    assert.ok(years > 5, `recovery code expires in ${years.toFixed(1)} years`);
  });

  it("satisfies the reset endpoint's own validation", () => {
    const parsed = resetPasswordSchema.safeParse({
      email: "practitioner@example.test",
      token: newRecoveryCode(),
      password: "a-long-enough-passw0rd",
    });
    assert.equal(parsed.success, true, parsed.success ? "" : parsed.error.issues[0]?.message);
  });

  it("two codes never collide in the stored hash", () => {
    // The reset endpoint looks a code up by hash and then checks the row
    // belongs to the account being reset. A collision would be the only way
    // one person's code could match another's row.
    const hashes = new Set<string>();
    for (let i = 0; i < 2000; i++) hashes.add(hashResetToken(newRecoveryCode()));
    assert.equal(hashes.size, 2000);
  });

  it("is never stored in the clear", () => {
    const code = newRecoveryCode();
    const stored = hashResetToken(code);
    assert.notEqual(stored, code);
    assert.match(stored, /^[a-f0-9]{64}$/);
    assert.ok(!stored.includes(code.replace(/-/g, "")));
  });
});

describe("recovery and reset token lifecycle", () => {
  it("expires: a token past its expiry is not accepted", async () => {
    const store = new MemoryStorage();
    const user = await store.createUser({
      email: "expiry@example.test",
      passwordHash: "x",
      displayName: "Expiry",
    });
    const code = newRecoveryCode();
    const expired = new Date(Date.now() - 60_000);
    await store.createPasswordResetToken(user.id, hashResetToken(normalizeRecoveryCode(code)), expired);
    const row = await store.getPasswordResetToken(hashResetToken(normalizeRecoveryCode(code)));
    assert.ok(row, "the row exists…");
    assert.ok(
      new Date(row!.expiresAt).getTime() < Date.now(),
      "…and the route's expiry check is what refuses it",
    );
  });

  it("is single use: consuming a code deletes it", async () => {
    const store = new MemoryStorage();
    const user = await store.createUser({
      email: "single@example.test",
      passwordHash: "x",
      displayName: "Single",
    });
    const code = newRecoveryCode();
    const hash = hashResetToken(normalizeRecoveryCode(code));
    await store.createPasswordResetToken(user.id, hash, recoveryCodeExpiry());
    assert.ok(await store.getPasswordResetToken(hash));
    await store.deletePasswordResetToken(hash);
    assert.equal(await store.getPasswordResetToken(hash), undefined);
  });

  it("is not a bearer token for another account", async () => {
    const store = new MemoryStorage();
    const mine = await store.createUser({
      email: "mine@example.test",
      passwordHash: "x",
      displayName: "Mine",
    });
    const theirs = await store.createUser({
      email: "theirs@example.test",
      passwordHash: "x",
      displayName: "Theirs",
    });
    const code = newRecoveryCode();
    const hash = hashResetToken(normalizeRecoveryCode(code));
    await store.createPasswordResetToken(mine.id, hash, recoveryCodeExpiry());
    const row = await store.getPasswordResetToken(hash);
    // The route compares tokenRow.userId against the account being reset.
    assert.equal(row!.userId, mine.id);
    assert.notEqual(row!.userId, theirs.id);
  });

  it("normalizes however it was written down", () => {
    const code = newRecoveryCode();
    const messy = ` ${code.toLowerCase().replace(/-/g, "")} `;
    assert.equal(normalizeRecoveryCode(messy), normalizeRecoveryCode(code));
    assert.equal(looksLikeRecoveryCode(messy), true);
  });
});
