import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ADS_OFF, adsConfigFromEnv, adsTxt, parseAdsConfig } from "./adsConfig";

describe("adsConfigFromEnv", () => {
  it("is off by default, and for anything but ADS_ENABLED=true", () => {
    assert.deepEqual(adsConfigFromEnv({}), ADS_OFF);
    assert.deepEqual(adsConfigFromEnv({ ADS_ENABLED: "1" }), ADS_OFF);
    assert.deepEqual(adsConfigFromEnv({ ADS_ENABLED: "false", ADS_PROVIDER: "adsense", ADSENSE_CLIENT_ID: "ca-pub-1234567890123456" }), ADS_OFF);
  });

  it("defaults to the house provider", () => {
    assert.deepEqual(adsConfigFromEnv({ ADS_ENABLED: "true" }), { enabled: true, provider: "house", adsenseClientId: null, slots: {} });
  });

  it("uses AdSense ids only for the adsense provider, and only valid ones", () => {
    const env = {
      ADS_ENABLED: "true", ADS_PROVIDER: "adsense", ADSENSE_CLIENT_ID: "ca-pub-1234567890123456",
      ADSENSE_SLOT_TODAY: "1111111111", ADSENSE_SLOT_CLASSES: "not-a-slot\"><script>", ADSENSE_SLOT_CLASS_DETAIL: "2222222222",
    };
    assert.deepEqual(adsConfigFromEnv(env), {
      enabled: true, provider: "adsense", adsenseClientId: "ca-pub-1234567890123456",
      slots: { today: "1111111111", classDetail: "2222222222" },
    });
    assert.equal(adsConfigFromEnv({ ...env, ADS_PROVIDER: "house" }).adsenseClientId, null);
  });

  it("falls back to the house card when AdSense has no valid client id", () => {
    assert.deepEqual(adsConfigFromEnv({ ADS_ENABLED: "true", ADS_PROVIDER: "adsense", ADSENSE_CLIENT_ID: "pub-oops" }),
      { enabled: true, provider: "house", adsenseClientId: null, slots: {} });
  });
});

describe("parseAdsConfig (client side of the embedded config)", () => {
  it("treats a missing or malformed config as ads off", () => {
    for (const value of [undefined, null, "true", {}, { enabled: "true" }]) assert.deepEqual(parseAdsConfig(value), ADS_OFF);
  });

  it("round-trips what the server embeds", () => {
    const config = adsConfigFromEnv({ ADS_ENABLED: "true", ADS_PROVIDER: "adsense", ADSENSE_CLIENT_ID: "ca-pub-1234567890123456", ADSENSE_SLOT_TODAY: "1111111111" });
    assert.deepEqual(parseAdsConfig(JSON.parse(JSON.stringify(config))), config);
  });
});

describe("adsTxt", () => {
  it("uses Google's format with the pub- id", () => {
    assert.equal(adsTxt("ca-pub-1234567890123456"), "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
  });
});
