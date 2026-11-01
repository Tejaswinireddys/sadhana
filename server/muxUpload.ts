export type MuxUploadResult = { uploadId: string; assetId: string; playbackId: string };
export type MuxUploadOptions = {
  tokenId: string;
  tokenSecret: string;
  body?: BodyInit;
  size?: number;
  resumeUploadId?: string;
  fetcher?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
  attempts?: number;
  onCreated?: (uploadId: string) => Promise<void>;
};

/** Direct upload uses separate credentials for the API; signed upload URLs never receive the API token. */
export async function uploadToMux(options: MuxUploadOptions): Promise<MuxUploadResult> {
  const { tokenId, tokenSecret } = options;
  if (!tokenId || !tokenSecret) throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET are required");
  const fetcher = options.fetcher || fetch;
  const wait = options.wait || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const api = async (path: string, body?: unknown) => {
    const res = await fetcher(`https://api.mux.com/video/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Mux API returned HTTP ${res.status}`);
    return (await res.json()).data;
  };
  let uploadId = options.resumeUploadId;
  if (uploadId && !/^[a-zA-Z0-9_-]+$/.test(uploadId)) throw new Error("Invalid upload ID");
  if (!uploadId) {
    if (!options.body || !options.size) throw new Error("A nonempty video file is required");
    const upload = await api("uploads", { new_asset_settings: { playback_policies: ["public"], video_quality: "basic" } });
    uploadId = upload.id;
    if (!uploadId || !upload.url?.startsWith("https://")) throw new Error("Mux returned an invalid upload");
    await options.onCreated?.(uploadId);
    const res = await fetcher(upload.url, {
      method: "PUT", headers: { "Content-Type": "application/octet-stream", "Content-Length": String(options.size) },
      body: options.body, duplex: "half", signal: AbortSignal.timeout(30 * 60_000),
    } as RequestInit);
    if (!res.ok) throw new Error(`Mux file upload returned HTTP ${res.status}`);
  }
  for (let attempt = 0; attempt < (options.attempts ?? 180); attempt++) {
    const upload = await api(`uploads/${uploadId}`);
    if (["errored", "cancelled", "timed_out"].includes(upload.status)) throw new Error(`Mux upload ${uploadId} ${upload.status}`);
    if (upload.asset_id) {
      const asset = await api(`assets/${encodeURIComponent(upload.asset_id)}`);
      if (asset.status === "errored") throw new Error(`Mux asset ${asset.id} errored`);
      if (asset.status === "ready") {
        const playbackId = asset.playback_ids?.find((row: { policy: string; id: string }) => row.policy === "public")?.id;
        if (!playbackId || !/^[a-zA-Z0-9_-]+$/.test(playbackId)) throw new Error("Ready asset has no valid public playback ID");
        return { uploadId: uploadId!, assetId: upload.asset_id, playbackId };
      }
    }
    await wait(5000);
  }
  throw new Error(`Mux processing timed out. Resume with --resume ${uploadId}`);
}
