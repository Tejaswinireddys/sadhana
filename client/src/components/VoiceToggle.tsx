// VoiceToggle — a sidebar settings control that turns guided voice narration on
// or off. Persisted via the backend (/api/preferences, NOT localStorage).
// Defaults to ON. When OFF, all VoicePlayer components disable themselves and
// show a "Voice disabled — enable in settings" tooltip.
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Volume2, VolumeX } from "lucide-react";
import type { Preferences } from "@shared/schema";

export function VoiceToggle() {
  const { data: prefs } = useQuery<Preferences>({ queryKey: ["/api/preferences"] });
  const enabled = prefs ? prefs.voiceEnabled === 1 : true;

  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      apiRequest("PATCH", "/api/preferences", { voiceEnabled: next ? 1 : 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/preferences"] });
    },
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2"
      onClick={() => mutation.mutate(!enabled)}
      data-testid="button-voice-toggle"
      aria-pressed={enabled}
    >
      {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      {enabled ? "Voice on" : "Voice off"}
    </Button>
  );
}
