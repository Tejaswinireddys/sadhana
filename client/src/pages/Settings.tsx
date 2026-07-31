import { useRef, useState, useEffect } from "react";
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
import { KEYS, readJson, readString, removeKey, writeJson, writeString, type ReminderPrefs } from "@/lib/localPrefs";
import {
  downloadOfflinePack,
  clearOfflinePack,
  offlinePackStatus,
} from "@/lib/offlinePack";
import { habitDayLabel, readHabitPlan, writeHabitPlan, type HabitPlan } from "@/lib/habitPlan";
import { readAnalyticsPrefs, writeAnalyticsPrefs } from "@/lib/analytics";
import type { Session } from "@shared/schema";
import { Moon, Sun, Laptop, Download, Upload, Trash2, Bell, CalendarPlus, Info, UserRound } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const DEFAULT_REMINDER: ReminderPrefs = { enabled: true, hour: 18, notifications: false };

export default function Settings() {
  useDocumentTitle("Settings · Sadhana");
  const { preference, setPreference } = useTheme();
  const { toast } = useToast();
  const { user, isSignedIn } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [reminder, setReminder] = useState<ReminderPrefs>(() =>
    readJson(KEYS.reminder, DEFAULT_REMINDER),
  );
  const [practitionerName, setPractitionerName] = useState(() => readString(KEYS.practitionerName) ?? "");
  const [habit, setHabit] = useState<HabitPlan>(() => readHabitPlan());
  const [analyticsOn, setAnalyticsOn] = useState(() => readAnalyticsPrefs().enabled);
  const [offlineStatus, setOfflineStatus] = useState({ present: false, entries: 0 });

  useEffect(() => {
    void offlinePackStatus().then(setOfflineStatus);
  }, []);

  const savePractitionerName = () => {
    const trimmed = practitionerName.trim();
    if (trimmed) writeString(KEYS.practitionerName, trimmed);
    else removeKey(KEYS.practitionerName);
    toast({ title: trimmed ? "Name saved" : "Name cleared" });
  };

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
          <CardTitle className="font-serif text-xl">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground" data-testid="settings-account-status">
            {isSignedIn
              ? `Signed in as ${user?.displayName || user?.email}. Your practice syncs to this account.`
              : "Practising as a guest — this device holds your history. An account keeps it when you switch browsers."}
          </p>
          <Button variant="outline" className="min-h-11 w-full cursor-pointer justify-start gap-2" asChild>
            <Link href="/account" data-testid="settings-account">
              <UserRound className="h-4 w-4" />
              {isSignedIn ? "Manage account" : "Sign in or create an account"}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="surface-inset border-0 shadow-none">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Your practice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="settings-name">Display name</Label>
            <Input
              id="settings-name"
              value={practitionerName}
              onChange={(e) => setPractitionerName(e.target.value)}
              placeholder="How should Home greet you?"
              maxLength={48}
              className="min-h-11"
              data-testid="settings-name"
            />
            <Button
              variant="outline"
              className="min-h-11 cursor-pointer"
              onClick={savePractitionerName}
              data-testid="settings-save-name"
            >
              Save name
            </Button>
          </div>
          <Button variant="outline" className="min-h-11 w-full cursor-pointer justify-start gap-2" asChild>
            <Link href="/register" data-testid="settings-register">
              <Info className="h-4 w-4" />
              Create or update practice setup
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="surface-inset border-0 shadow-none">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Experience</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-sm font-medium">Appearance</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Saved on this device. “System” follows your OS setting.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Appearance">
              {(
                [
                  { id: "light", label: "Light", Icon: Sun },
                  { id: "dark", label: "Dark", Icon: Moon },
                  { id: "system", label: "System", Icon: Laptop },
                ] as const
              ).map(({ id, label, Icon }) => (
                <Button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={preference === id}
                  variant={preference === id ? "default" : "outline"}
                  className="min-h-11 justify-center gap-1.5"
                  onClick={() => setPreference(id)}
                  data-testid={`settings-theme-${id}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <Button variant="outline" className="min-h-11 w-full cursor-pointer justify-start gap-2" asChild>
            <Link href="/welcome" data-testid="settings-about">
              <Info className="h-4 w-4" />
              About Sadhana — product overview
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/privacy" className="underline underline-offset-2" data-testid="settings-privacy">
              Privacy
            </Link>
            <span aria-hidden>·</span>
            <Link href="/terms" className="underline underline-offset-2" data-testid="settings-terms">
              Terms
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="/health-disclaimer"
              className="underline underline-offset-2"
              data-testid="settings-health"
            >
              Health disclaimer
            </Link>
            <span aria-hidden>·</span>
            <Link href="/account" className="underline underline-offset-2">
              Account
            </Link>
          </div>
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
          <CardTitle className="font-serif text-xl">Habit plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pick practice days and quiet hours. Missed days suggest a short recovery session — no
            streak punishment.
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Practice days">
            {([0, 1, 2, 3, 4, 5, 6] as const).map((d) => {
              const on = habit.days.includes(d);
              return (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  className="min-h-11 min-w-11"
                  variant={on ? "default" : "outline"}
                  aria-pressed={on}
                  onClick={() => {
                    const days = on ? habit.days.filter((x) => x !== d) : [...habit.days, d].sort();
                    const next = { ...habit, days };
                    setHabit(next);
                    writeHabitPlan(next);
                  }}
                  data-testid={`habit-day-${d}`}
                >
                  {habitDayLabel(d)}
                </Button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="habit-recovery">Compassionate missed-day recovery</Label>
            <Switch
              id="habit-recovery"
              checked={habit.compassionateRecovery}
              onCheckedChange={(compassionateRecovery) => {
                const next = { ...habit, compassionateRecovery };
                setHabit(next);
                writeHabitPlan(next);
              }}
              data-testid="habit-recovery"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Offline practice pack</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cache shell assets and a few foundation pose images for flaky networks. API practice
            data is never stored offline.
          </p>
          <p className="text-xs text-muted-foreground" data-testid="offline-status">
            {offlineStatus.present
              ? `${offlineStatus.entries} assets cached`
              : "No offline pack downloaded yet"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void downloadOfflinePack()
                  .then(async (r) => {
                    setOfflineStatus(await offlinePackStatus());
                    toast({
                      title: "Offline pack ready",
                      description: `Cached ${r.cached} assets${r.failed ? ` (${r.failed} failed)` : ""}.`,
                    });
                  })
                  .catch((e) =>
                    toast({
                      title: "Download failed",
                      description: e instanceof Error ? e.message : "Try again",
                      variant: "destructive",
                    }),
                  )
                  .finally(() => setBusy(false));
              }}
              data-testid="settings-offline-download"
            >
              Download offline pack
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                void clearOfflinePack().then(async () => {
                  setOfflineStatus(await offlinePackStatus());
                  toast({ title: "Offline pack cleared" });
                });
              }}
              data-testid="settings-offline-clear"
            >
              Clear pack
            </Button>
          </div>
          <Button variant="outline" className="min-h-11 w-full justify-start" asChild>
            <Link href="/plus">Sadhana Plus plans (coming soon)</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Privacy-first analytics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="analytics-enabled">Share anonymous product events</Label>
            <Switch
              id="analytics-enabled"
              checked={analyticsOn}
              onCheckedChange={(enabled) => {
                setAnalyticsOn(enabled);
                writeAnalyticsPrefs({ enabled });
              }}
              data-testid="settings-analytics"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Off by default. Never includes journal text, emails, or injury notes — only event names
            like practice_start.
          </p>
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
