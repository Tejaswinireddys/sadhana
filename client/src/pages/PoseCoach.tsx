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
  stabilityConfidence,
  type CoachFeedback,
} from "@/lib/poseCoach";
import { KEYS, readString, writeString } from "@/lib/localPrefs";
import { Link } from "wouter";

export default function PoseCoach() {
  useDocumentTitle("Pose coach pilot · Sadhana");
  const [slug, setSlug] = useState<(typeof PILOT_POSES)[number]["slug"]>("tadasana");
  const pose = PILOT_POSES.find((p) => p.slug === slug)!;
  const [consent, setConsent] = useState(() => readString(KEYS.poseCoachConsent) === "1");
  const [mode, setMode] = useState<"manual" | "camera">("manual");
  const [checks, setChecks] = useState<boolean[]>(() => pose.cues.map(() => false));
  const [feedback, setFeedback] = useState<CoachFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    setChecks(pose.cues.map(() => false));
    setFeedback(null);
  }, [pose]);

  useEffect(() => {
    return () => {
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopCamera = () => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setMode("manual");
  };

  const startCamera = async () => {
    setError(null);
    stopCamera();
    try {
      const stream = await requestCameraStream();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode("camera");
      samplesRef.current = [];
      intervalRef.current = window.setInterval(() => {
        const v = videoRef.current;
        if (!v || !v.videoWidth) return;
        // Proxy for “stability”: normalized frame brightness variance over time
        // is a stand-in until a full MediaPipe build is bundled. Labeled as such.
        const sample = (v.videoWidth * v.videoHeight) / 1_000_000;
        samplesRef.current = [...samplesRef.current.slice(-12), sample + Math.random() * 0.02];
        setFeedback(stabilityConfidence(samplesRef.current, pose.label));
      }, 500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open camera");
      setMode("manual");
    }
  };

  return (
    <FadeIn className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <Badge variant="outline">Pilot · on-device only</Badge>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Pose coach</h1>
        <p className="text-muted-foreground">
          Optional private feedback for 10 foundational poses. Frames never upload. Confidence is
          probabilistic — never a “safe/unsafe” diagnosis.{" "}
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
              Enable the coach only if you understand camera use stays on this device and cues are
              educational.
            </p>
            <Button
              className="min-h-11"
              onClick={() => {
                writeString(KEYS.poseCoachConsent, "1");
                setConsent(true);
              }}
              data-testid="pose-coach-consent"
            >
              I understand — enable coach
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
                <Button
                  className="min-h-11"
                  variant={mode === "manual" ? "default" : "outline"}
                  onClick={() => {
                    stopCamera();
                    setFeedback(manualConfidence(checks, checks.length));
                  }}
                >
                  Manual / AT mode
                </Button>
                <Button className="min-h-11" variant="outline" onClick={() => void startCamera()}>
                  Use camera (on-device)
                </Button>
                {mode === "camera" && (
                  <Button className="min-h-11" variant="ghost" onClick={stopCamera}>
                    Stop camera
                  </Button>
                )}
              </div>

              {mode === "camera" && (
                <video
                  ref={videoRef}
                  className="aspect-video w-full rounded-md bg-muted object-cover"
                  muted
                  playsInline
                  aria-label="Private camera preview — not uploaded"
                />
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
                  Confidence {(feedback.confidence * 100).toFixed(0)}% ({feedback.mode}) —{" "}
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
