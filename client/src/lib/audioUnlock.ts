/** Unlock iOS/WebKit audio on a user gesture so guided voice can play. */
let unlocked = false;

export async function unlockAudio(): Promise<void> {
  if (unlocked) return;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      if (ctx.state === "suspended") await ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
      setTimeout(() => ctx.close().catch(() => {}), 50);
    }
  } catch {
    /* ignore */
  }
  try {
    const a = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=",
    );
    a.volume = 0.01;
    await a.play().catch(() => {});
    a.pause();
  } catch {
    /* ignore */
  }
  unlocked = true;
}
