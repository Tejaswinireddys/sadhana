/**
 * "This isn't the length you asked for" — said once, with a way out.
 *
 * Every generator can fail to honour a requested duration: narration is a
 * fixed cost per pose and cannot be shortened, so below a certain length the
 * only honest answers are fewer poses, captions instead of voice, or a longer
 * slot. This component states the problem once and offers those choices
 * explicitly, so nothing is substituted behind the practitioner's back.
 *
 * Shared by the Trainer, the Adaptive Plan and Today so the three cannot drift
 * into three different explanations of the same arithmetic.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SessionFit } from "@/lib/sessionFit";
import { AlertTriangle } from "lucide-react";

export function DurationFitNotice({
  fit,
  /** A length this sequence can actually be taught in, from what the screen offers. */
  offerMinutes,
  onUseOfferedMinutes,
  /** Present only when captions-only would fit the original request. */
  briefOffer,
  onUseBriefMode,
  testIdPrefix = "duration-fit",
}: {
  fit: SessionFit;
  offerMinutes?: number | null;
  onUseOfferedMinutes?: (minutes: number) => void;
  briefOffer?: { minutes: number; savedMinutes: number } | null;
  onUseBriefMode?: () => void;
  testIdPrefix?: string;
}) {
  if (!fit.explanation) return null;
  return (
    <Card className="border-primary/40 bg-primary/5" data-testid={`card-${testIdPrefix}`}>
      <CardContent className="space-y-3 p-4">
        <p className="flex items-start gap-2 text-sm" data-testid={`text-${testIdPrefix}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>{fit.explanation}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {offerMinutes != null && onUseOfferedMinutes && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => onUseOfferedMinutes(offerMinutes)}
              data-testid={`button-${testIdPrefix}-longer`}
            >
              Give it {offerMinutes} minutes instead
            </Button>
          )}
          {briefOffer && onUseBriefMode && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={onUseBriefMode}
              data-testid={`button-${testIdPrefix}-captions`}
            >
              Practise in {briefOffer.minutes} min with captions, no voice
            </Button>
          )}
        </div>
        {briefOffer && onUseBriefMode && (
          <p className="text-xs text-muted-foreground">
            The same poses and the same holds — the instructions appear on screen instead of being
            read aloud, which is what the extra {briefOffer.savedMinutes} min is.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
