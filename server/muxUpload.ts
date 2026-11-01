export type MuxUploadResult = {
  uploadId: string; assetId: string; playbackId: string; playbackPolicy: "public" | "signed";
  /** The quality tier the asset was created with. */
  videoQuality: MuxVideoQuality;
};
export type MuxVideoQuality = "basic" | "plus";
export type MuxUploadOptions = {
  isPlus?: boolean;
  tokenId: string;
  tokenSecret: string;
  body?: BodyInit;
  size?: number;
  resumeUploadId?: string;
  fetcher?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
  attempts?: number;
  onCreated?: (uploadId: string) => Promise<void>;
  /**
   * "plus" asks for Mux's higher encoding tier and falls back to "basic" when
   * the account cannot use it (Mux answers 4xx). Default "basic", as before.
   */
  videoQuality?: MuxVideoQuality;
};

/** Direct upload uses separate credentials for the API; signed upload URLs never receive the API token. */
export async function uploadToMux(options: MuxUploadOptions): Promise<MuxUploadResult> {
  const { tokenId, tokenSecret } = options;
  const playbackPolicy = options.isPlus ? "signed" : "public";
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
    if (!res.ok) throw Object.assign(new Error(`Mux API returned HTTP ${res.status}`), { status: res.status });
    return (await res.json()).data;
  };
  let videoQuality: MuxVideoQuality = options.videoQuality ?? "basic";
  let uploadId = options.resumeUploadId;
  if (uploadId && !/^[a-zA-Z0-9_-]+$/.test(uploadId)) throw new Error("Invalid upload ID");
  if (!uploadId) {
    if (!options.body || !options.size) throw new Error("A nonempty video file is required");
    const create = (quality: MuxVideoQuality) =>
      api("uploads", { new_asset_settings: { playback_policies: [playbackPolicy], video_quality: quality } });
    let upload;
    try {
      upload = await create(videoQuality);
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (videoQuality !== "plus" || !status || status < 400 || status >= 500) throw error;
      videoQuality = "basic";
      upload = await create(videoQuality);
    }
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
        const playbackId = asset.playback_ids?.find((row: { policy: string; id: string }) => row.policy === playbackPolicy)?.id;
        if (options.isPlus && asset.playback_ids?.some((row: { policy: string }) => row.policy === "public")) {
          throw new Error("Plus asset has public playback IDs; remove them in Mux before resuming");
        }
        if (!playbackId || !/^[a-zA-Z0-9_-]+$/.test(playbackId)) throw new Error(`Ready asset has no valid ${playbackPolicy} playback ID`);
        if (asset.video_quality === "plus" || asset.video_quality === "basic") videoQuality = asset.video_quality;
        return { uploadId: uploadId!, assetId: upload.asset_id, playbackId, playbackPolicy, videoQuality };
      }
    }
    await wait(5000);
  }
  throw new Error(`Mux processing timed out. Resume with --resume ${uploadId}`);
}
