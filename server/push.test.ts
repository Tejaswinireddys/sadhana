import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { localDayHourKey, localHourFor } from "./pushTime";

describe("pushTime", () => {
  it("converts UTC to subscriber-local hour via timezoneOffsetMinutes", () => {
    const sub = { timezoneOffsetMinutes: 300 }; // UTC-5
    const noonUtc = new Date("2026-07-31T12:00:00.000Z");
    assert.equal(localHourFor(sub, noonUtc), 7);
    assert.equal(localDayHourKey(sub, noonUtc), "2026-07-31T07");
  });

  it("handles negative offsets (east of UTC)", () => {
    const sub = { timezoneOffsetMinutes: -120 }; // UTC+2
    const noonUtc = new Date("2026-07-31T12:00:00.000Z");
    assert.equal(localHourFor(sub, noonUtc), 14);
  });
});
