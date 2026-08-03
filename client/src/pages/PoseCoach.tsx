import { useEffect, useRef, useState } from "react";
import { FadeIn } from "@/components/motion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PILOT_POSES,
  manualConfidence,
  requestCameraStream,
  type CoachFeedback,
} from "@/lib/poseCoach";
import { KEYS, readString, writeString } from "@/lib/localPrefs";
import { Link } from "wouter";

export default function PoseCoach() {
  useDocumentTitle("Pose self-check · Sadhana");
  const [slug, setSlug] = useState<(typeof PILOT_POSES)[number]["slug"]>("tadasana");
  const pose = PILOT_POSES.find((p) => p.slug === slug)!;
  const [consent, setConsent] = useState(() => readString(KEYS.poseCoachConsent) === "1");
  const [cameraOn, setCameraOn] = useState(false);
  const [checks, setChecks] = useState<boolean[]>(() => pose.cues.map(() => false));
  const [feedback, setFeedback] = useState<CoachFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setChecks(pose.cues.map(() => false));
    setFeedback(null);
  }, [pose]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    setError(null);
    stopCamera();
    try {
      // A private on-device preview only — we never read frame pixels, analyze
      // the body, or score the pose. It's a mirror to help you frame yourself.
      const stream = await requestCameraStream();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open camera");
      setCameraOn(false);
    }
  };

  return (
    <FadeIn className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <Badge variant="outline">Self-check · private on-device preview</Badge>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Pose self-check</h1>
        <p className="text-muted-foreground">
          A self-check list for 10 foundational poses, plus an optional private camera preview to
          help you frame yourself. This does <strong>not</strong> analyze your body or judge your
          posture — the camera is only a mirror, frames never upload, and the only score comes from
          the cues you tick yourself.{" "}
          <Link href="/health-disclaimer" className="underline underline-offset-2">
            Health disclaimer
          </Link>
          .
        </p>
      </header>

      {!consent ? (
        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">
              Turn on the optional camera preview only if you understand it stays on this device, is
              never analyzed or uploaded, and the cues are educational self-checks.
            </p>
            <Button
              className="min-h-11"
              onClick={() => {
                writeString(KEYS.poseCoachConsent, "1");
                setConsent(true);
              }}
              data-testid="pose-coach-consent"
            >
              I understand — continue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {PILOT_POSES.map((p) => (
              <Button
                key={p.slug}
                size="sm"
                className="min-h-11"
                variant={slug === p.slug ? "default" : "outline"}
                onClick={() => setSlug(p.slug)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-xl">{pose.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {!cameraOn ? (
                  <Button className="min-h-11" variant="outline" onClick={() => void startCamera()}>
                    Show camera preview (optional)
                  </Button>
                ) : (
                  <Button className="min-h-11" variant="ghost" onClick={stopCamera}>
                    Stop camera preview
                  </Button>
                )}
              </div>

              {cameraOn && (
                <div className="space-y-1">
                  <video
                    ref={videoRef}
                    className="aspect-video w-full rounded-md bg-muted object-cover"
                    muted
                    playsInline
                    aria-label="Private camera mirror — not analyzed or uploaded"
                  />
                  <p className="text-xs text-muted-foreground">
                    Mirror only — your posture isn't analyzed or scored. Use the checklist below to
                    self-check.
                  </p>
                </div>
              )}

              <ul className="space-y-2">
                {pose.cues.map((cue, i) => (
                  <li key={cue}>
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={checks[i] ?? false}
                        onChange={(e) => {
                          const next = [...checks];
                          next[i] = e.target.checked;
                          setChecks(next);
                          setFeedback(manualConfidence(next, next.length));
                        }}
                      />
                      {cue}
                    </label>
                  </li>
                ))}
              </ul>

              {feedback && (
                <p
                  className="rounded-md border border-border p-3 text-sm"
                  role="status"
                  data-testid="pose-coach-feedback"
                >
                  Self-check: {(feedback.confidence * 100).toFixed(0)}% of cues confirmed —{" "}
                  {feedback.message}
                </p>
              )}
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button variant="outline" className="min-h-11" asChild>
                <Link href={`/asanas/${pose.slug}`}>Open pose teaching page</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </FadeIn>
  );
}
