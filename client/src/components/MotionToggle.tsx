// MotionToggle — a sidebar settings control that turns pose/breath animations
// on or off. The preference is persisted via the backend (/api/preferences,
// NOT localStorage) and applied by toggling the `motion-off` class on the
// <html> element. Defaults to ON.

import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Activity, ZapOff } from "lucide-react";
import type { Preferences } from "@shared/schema";

function applyMotion(enabled: boolean) {
  const root = document.documentElement;
  if (enabled) root.classList.remove("motion-off");
  else root.classList.add("motion-off");
}

export function MotionToggle() {
  const { data: prefs } = useQuery<Preferences>({ queryKey: ["/api/preferences"] });

  // motionEnabled is stored as 1/0; default ON until loaded
  const enabled = prefs ? prefs.motionEnabled === 1 : true;

  // apply the class whenever the preference resolves/changes
  useEffect(() => {
    applyMotion(enabled);
  }, [enabled]);

  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      apiRequest("PATCH", "/api/preferences", { motionEnabled: next ? 1 : 0 }),
    onMutate: (next: boolean) => {
      // optimistic apply for instant feedback
      applyMotion(next);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/preferences"] });
    },
  });

  const toggle = () => mutation.mutate(!enabled);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2"
      onClick={toggle}
      data-testid="button-motion-toggle"
      aria-pressed={enabled}
    >
      {enabled ? <Activity className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
      {enabled ? "Animations on" : "Animations off"}
    </Button>
  );
}
