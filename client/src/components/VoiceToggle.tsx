// VoiceToggle — sidebar control for guided voice narration.
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Volume2, VolumeX } from "lucide-react";
import type { Preferences } from "@shared/schema";

export function VoiceToggle() {
  const { data: prefs } = useQuery<Preferences>({ queryKey: ["/api/preferences"] });
  const serverOn = prefs ? prefs.voiceEnabled === 1 : true;
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const enabled = optimistic ?? serverOn;

  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      apiRequest("PATCH", "/api/preferences", { voiceEnabled: next ? 1 : 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/preferences"] });
    },
    onSettled: () => {
      setOptimistic(null);
    },
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2"
      onClick={() => {
        const next = !enabled;
        setOptimistic(next);
        mutation.mutate(next);
      }}
      data-testid="button-voice-toggle"
      aria-pressed={enabled}
    >
      {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      {enabled ? "Voice on" : "Voice off"}
    </Button>
  );
}
