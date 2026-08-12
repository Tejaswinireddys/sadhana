// Opt-in browser speechSynthesis when no MP3 narration is available.
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bot } from "lucide-react";
import type { Preferences } from "@shared/schema";

export function RobotVoiceToggle() {
  const { data: prefs } = useQuery<Preferences>({ queryKey: ["/api/preferences"] });
  const enabled = prefs ? prefs.allowRobotVoice === 1 : false;

  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      apiRequest("PATCH", "/api/preferences", { allowRobotVoice: next ? 1 : 0 }),
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
      data-testid="button-robot-voice-toggle"
      aria-pressed={enabled}
      title="Use the device voice when a recorded guide is missing"
    >
      <Bot className="h-4 w-4" />
      {enabled ? "Robot voice on" : "Robot voice off"}
    </Button>
  );
}
