import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MotionToggle } from "@/components/MotionToggle";
import { VoiceToggle } from "@/components/VoiceToggle";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  buildExport,
  clearAllData,
  downloadExport,
  downloadReminderIcs,
  importExport,
  type SadhanaExport,
} from "@/lib/dataPortability";
import { KEYS, readJson, writeJson, type ReminderPrefs } from "@/lib/localPrefs";
import type { Session } from "@shared/schema";
import { Moon, Sun, Download, Upload, Trash2, Bell, CalendarPlus, Info } from "lucide-react";
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const DEFAULT_REMINDER: ReminderPrefs = { enabled: true, hour: 18, notifications: false };

export default function Settings() {
  useDocumentTitle("Settings · Sadhana");
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [reminder, setReminder] = useState<ReminderPrefs>(() =>
    readJson(KEYS.reminder, DEFAULT_REMINDER),
  );

  const { data: sessions = [] } = useQuery<Session[]>({ queryKey: ["/api/sessions"] });

  const saveReminder = (next: ReminderPrefs) => {
    setReminder(next);
    writeJson(KEYS.reminder, next);
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      toast({ title: "Notifications not supported in this browser" });
      return;
    }
    const perm = await Notification.requestPermission();
    const enabled = perm === "granted";
    saveReminder({ ...reminder, notifications: enabled });
    toast({
      title: enabled ? "Notifications enabled" : "Notifications blocked",
      description: enabled
        ? "You'll get a gentle nudge around your reminder hour when the tab is open."
        : "You can still use the in-app banner and calendar file.",
    });
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const data = await buildExport();
      downloadExport(data);
      toast({ title: "Export downloaded" });
    } catch (e) {
      toast({
        title: "Export failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as SadhanaExport;
      if (data.version !== 1) throw new Error("Unsupported export version");
      const result = await importExport(data);
      queryClient.invalidateQueries();
      toast({
        title: "Import complete",
        description: `Imported ${result.imported} items into this browser's practice data.`,
      });
    } catch (e) {
      toast({
        title: "Import failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const wipe = useMutation({
    mutationFn: clearAllData,
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "All practice data cleared on this device" });
    },
    onError: (e: Error) =>
      toast({ title: "Clear failed", description: e.message, variant: "destructive" }),
  });

  const delSession = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/stats"] });
      toast({ title: "Session deleted" });
    },
  });

  const clearProfile = useMutation({
    mutationFn: () => apiRequest("POST", "/api/profile/deactivate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/active"] });
      toast({ title: "Profile cleared" });
    },
  });

  return (
    <div className="animate-fade-in space-y-8">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Preferences, reminders, and a backup of your practice on this device.
        </p>
      </header>

      <Card className="surface-inset border-0 shadow-none">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Experience</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={toggle}
            data-testid="settings-theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          </Button>
          <Button variant="outline" className="min-h-11 w-full cursor-pointer justify-start gap-2" asChild>
            <Link href="/welcome" data-testid="settings-about">
              <Info className="h-4 w-4" />
              About Sadhana — product overview
            </Link>
          </Button>
          <Button variant="outline" className="min-h-11 w-full cursor-pointer justify-start gap-2" asChild>
            <Link href="/design-system" data-testid="settings-design-system">
              <Info className="h-4 w-4" />
              Design system preview
            </Link>
          </Button>
          <div className="rounded-md border border-border p-3">
            <VoiceToggle />
          </div>
          <div className="rounded-md border border-border p-3">
            <MotionToggle />
          </div>
          <Button
            variant="outline"
            onClick={() => clearProfile.mutate()}
            disabled={clearProfile.isPending}
            data-testid="settings-clear-profile"
          >
            Clear active profile
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Practice reminders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="reminder-enabled">In-app evening nudge</Label>
            <Switch
              id="reminder-enabled"
              checked={reminder.enabled}
              onCheckedChange={(enabled) => saveReminder({ ...reminder, enabled })}
              data-testid="settings-reminder-enabled"
            />
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="reminder-hour" className="shrink-0">
              After
            </Label>
            <Input
              id="reminder-hour"
              type="number"
              min={0}
              max={23}
              className="w-24"
              value={reminder.hour}
              onChange={(e) =>
                saveReminder({
                  ...reminder,
                  hour: Math.min(23, Math.max(0, Number(e.target.value) || 0)),
                })
              }
              data-testid="settings-reminder-hour"
            />
            <span className="text-sm text-muted-foreground">:00 local time</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={requestNotifications} data-testid="settings-notif">
              <Bell className="mr-1.5 h-4 w-4" />
              {reminder.notifications ? "Notifications on" : "Enable notifications"}
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadReminderIcs(reminder.hour)}
              data-testid="settings-ics"
            >
              <CalendarPlus className="mr-1.5 h-4 w-4" /> Add to calendar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="surface-raised">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Backup &amp; data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={doExport} disabled={busy} data-testid="settings-export">
              <Download className="mr-1.5 h-4 w-4" /> Export JSON
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              data-testid="settings-import"
            >
              <Upload className="mr-1.5 h-4 w-4" /> Import JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void doImport(f);
                e.target.value = "";
              }}
            />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-testid="settings-wipe">
                <Trash2 className="mr-1.5 h-4 w-4" /> Clear all data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all practice data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes sessions, journal entries, favorites, pathways, and custom flows for
                  this browser. Export a backup first if you might want it back.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => wipe.mutate()}>Clear everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Recent sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.length === 0 && (
            <p className="text-sm text-muted-foreground">No sessions logged yet.</p>
          )}
          {sessions.slice(0, 20).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              data-testid={`session-row-${s.id}`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {s.date.slice(0, 10)} · {s.durationMinutes} min · {s.kind}
                </p>
                <p className="truncate text-xs text-muted-foreground">{s.asanas}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => delSession.mutate(s.id)}
                aria-label="Delete session"
                data-testid={`button-delete-session-${s.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
