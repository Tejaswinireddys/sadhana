import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { EIGHT_LIMBS, limbForDay, readEightLimbsStart } from "@/data/eightLimbs";
import { todayISO } from "@/lib/sadhana";

function speak(text: string) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
  return true;
}

export default function EightLimbs() {
  useDocumentTitle("Eight limbs · Sadhana");
  const today = todayISO();
  const limb = limbForDay(readEightLimbsStart(today), today);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  return (
    <div className="animate-fade-in mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Eight limbs</h1>
        <p className="text-muted-foreground">
          One card a day from the eight-limb list in Patañjali's Yoga Sūtra. It is a classical
          framework, not a religion to join and not a claim about you. The pronunciation is a
          computer voice reading a guide, not a recorded teacher.
        </p>
      </header>
      <Card data-testid="eight-limb-card">
        <CardContent className="space-y-4 p-6">
          <p className="text-xs text-muted-foreground" data-testid="eight-limb-day">
            Limb {limb.order} of 8
          </p>
          <h2 className="font-serif text-2xl" data-testid="eight-limb-name">
            {limb.name}
          </h2>
          <p className="text-lg" lang="sa" data-testid="eight-limb-devanagari">
            {limb.devanagari}
          </p>
          <p className="text-sm text-muted-foreground" data-testid="eight-limb-iast">
            IAST: {limb.iast}
            <span className="mx-2">·</span>
            Say: {limb.say}
          </p>
          <p className="text-sm font-medium">{limb.summary}</p>
          <p className="text-sm text-muted-foreground">{limb.body}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              data-testid="eight-limb-speak"
              onClick={() => {
                const ok = speak(`${limb.say}. ${limb.iast}`);
                setVoiceNote(
                  ok
                    ? "That was this device's computer voice, reading the guide above. It is not a Sanskrit recording."
                    : "This browser has no computer voice. The IAST and Devanagari above are the pronunciation guide.",
                );
              }}
            >
              Hear the name
            </Button>
            <Button type="button" className="min-h-11" asChild data-testid="eight-limb-practice">
              <Link href={limb.practiceHref}>{limb.practiceLabel}</Link>
            </Button>
          </div>
          {voiceNote && (
            <p className="text-sm text-muted-foreground" data-testid="eight-limb-voice-note">
              {voiceNote}
            </p>
          )}
        </CardContent>
      </Card>
      <ol className="space-y-1 text-sm text-muted-foreground" data-testid="eight-limb-list">
        {EIGHT_LIMBS.map((item) => (
          <li key={item.slug}>
            {item.order}. {item.name}
            {item.slug === limb.slug ? " — today" : ""}
          </li>
        ))}
      </ol>
    </div>
  );
}
