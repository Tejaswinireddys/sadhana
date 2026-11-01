import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadToMux } from "./muxUpload";

const json = (data: unknown) => new Response(JSON.stringify({ data }));

test("Mux upload streams to signed URL, waits for readiness, and returns playback ID", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  let created = "";
  const responses = [json({ id: "up_test", url: "https://upload.example/file" }), new Response(null, { status: 200 }),
    json({ status: "asset_created", asset_id: "asset_test" }), json({ id: "asset_test", status: "preparing" }),
    json({ status: "asset_created", asset_id: "asset_test" }), json({ id: "asset_test", status: "ready", playback_ids: [{ id: "public_test", policy: "public" }] })];
  const result = await uploadToMux({ tokenId: "fixture-id", tokenSecret: "fixture-secret", body: "file", size: 4,
    onCreated: async (id) => { created = id; }, wait: async () => {},
    fetcher: (async (url, init) => { calls.push({ url: String(url), init }); return responses.shift()!; }) as typeof fetch,
  });
  assert.deepEqual(result, { uploadId: "up_test", assetId: "asset_test", playbackId: "public_test", playbackPolicy: "public" });
  assert.equal(created, "up_test");
  assert.equal(calls[1].init?.method, "PUT");
  assert.equal((calls[1].init?.headers as Record<string, string>).Authorization, undefined);
  assert.match((calls[0].init?.headers as Record<string, string>).Authorization, /^Basic /);
  assert.deepEqual(JSON.parse(calls[0].init?.body as string).new_asset_settings.playback_policies, ["public"]);
});

test("Mux errors do not produce playback records and processing can resume", async () => {
  await assert.rejects(uploadToMux({ tokenId: "", tokenSecret: "" }), /required/);
  await assert.rejects(uploadToMux({ tokenId: "id", tokenSecret: "secret", resumeUploadId: "../bad" }), /Invalid/);
  await assert.rejects(uploadToMux({ tokenId: "id", tokenSecret: "secret", resumeUploadId: "up_test",
    fetcher: (async () => new Response(null, { status: 401 })) as typeof fetch,
  }), /HTTP 401/);
  await assert.rejects(uploadToMux({ tokenId: "id", tokenSecret: "secret", resumeUploadId: "up_test",
    fetcher: (async () => json({ status: "errored" })) as typeof fetch,
  }), /errored/);
  await assert.rejects(uploadToMux({ tokenId: "id", tokenSecret: "secret", resumeUploadId: "up_test", attempts: 1, wait: async () => {},
    fetcher: (async () => json({ status: "waiting" })) as typeof fetch,
  }), /--resume up_test/);
  const calls: string[] = [];
  const result = await uploadToMux({ tokenId: "id", tokenSecret: "secret", resumeUploadId: "up_test",
    fetcher: (async (url) => { calls.push(String(url)); return calls.length === 1
      ? json({ status: "asset_created", asset_id: "asset_test" })
      : json({ status: "ready", playback_ids: [{ id: "ready_id", policy: "public" }] }); }) as typeof fetch,
  });
  assert.equal(result.playbackId, "ready_id");
  assert.equal(calls.length, 2);
});


test("Plus uploads request signed playback and resumed public assets are rejected", async () => {
  const calls: RequestInit[] = [];
  const responses = [json({ id: "up_plus", url: "https://upload.example/file" }), new Response(null, { status: 200 }),
    json({ asset_id: "asset_plus" }), json({ status: "ready", playback_ids: [{ policy: "signed", id: "signed_id" }] })];
  const result = await uploadToMux({ isPlus: true, tokenId: "id", tokenSecret: "secret", body: "file", size: 4,
    fetcher: (async (_url, init) => { calls.push(init!); return responses.shift()!; }) as typeof fetch });
  assert.deepEqual(JSON.parse(calls[0].body as string).new_asset_settings.playback_policies, ["signed"]);
  assert.equal(result.playbackPolicy, "signed");
  assert.equal(result.assetId, "asset_plus");
  for (const playback_ids of [[{ policy: "public", id: "public_id" }], [{ policy: "signed", id: "signed_id" }, { policy: "public", id: "public_id" }]]) {
    let call = 0;
    await assert.rejects(uploadToMux({ isPlus: true, tokenId: "id", tokenSecret: "secret", resumeUploadId: "up_old",
      fetcher: (async () => json(++call === 1 ? { asset_id: "asset_old" } : { status: "ready", playback_ids })) as typeof fetch,
    }), /public playback IDs/);
  }
});
