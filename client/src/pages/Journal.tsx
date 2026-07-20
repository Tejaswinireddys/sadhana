import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MOODS, type Mood } from "@/data/content";
import { MOOD_ICONS } from "@/lib/moods";
import type { Journal as JournalEntry } from "@shared/schema";
import { todayISO, formatShortDate } from "@/lib/sadhana";
import { Plus, Search, Trash2, Timer } from "lucide-react";

type Draft = {
  id?: number;
  title: string;
  body: string;
  mood: Mood | "";
  tags: string;
};

const emptyDraft: Draft = { title: "", body: "", mood: "", tags: "" };

export default function Journal() {
  const { toast } = useToast();
  const search = useSearch();
  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({ queryKey: ["/api/journal"] });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState<Mood | "All">("All");

  // Pre-fill from query params (e.g. after a practice session)
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("new")) {
      setDraft({
        ...emptyDraft,
        title: params.get("title") || "",
        body: params.get("body") || "",
      });
      setOpen(true);
    }
  }, [search]);

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const payload = {
        date: todayISO(),
        title: d.title || null,
        body: d.body,
        mood: d.mood || null,
        tags: JSON.stringify(
          d.tags.split(",").map((t) => t.trim()).filter(Boolean),
        ),
      };
      if (d.id) return apiRequest("PATCH", `/api/journal/${d.id}`, payload);
      return apiRequest("POST", "/api/journal", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      setOpen(false);
      setDraft(emptyDraft);
      toast({ title: "Entry saved" });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/journal/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      setDeleteId(null);
      toast({ title: "Entry deleted" });
    },
  });

  const openEdit = (e: JournalEntry) => {
    let tags: string[] = [];
    try { tags = JSON.parse(e.tags || "[]"); } catch { tags = []; }
    setDraft({
      id: e.id,
      title: e.title || "",
      body: e.body,
      mood: (e.mood as Mood) || "",
      tags: tags.join(", "),
    });
    setOpen(true);
  };

  const filtered = entries.filter((e) => {
    const matchesMood = moodFilter === "All" || e.mood === moodFilter;
    const q = query.toLowerCase();
    const matchesText =
      !q ||
      (e.title || "").toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q) ||
      (e.tags || "").toLowerCase().includes(q);
    return matchesMood && matchesText;
  });

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Journal</h1>
          <p className="text-muted-foreground">Reflect on your practice and track how you feel.</p>
        </div>
        <Button onClick={() => { setDraft(emptyDraft); setOpen(true); }} data-testid="button-new-entry">
          <Plus className="mr-1.5 h-4 w-4" /> New entry
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search entries..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-journal"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["All", ...MOODS] as const).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={moodFilter === m ? "default" : "outline"}
              onClick={() => setMoodFilter(m)}
              data-testid={`filter-mood-${m.toLowerCase()}`}
            >
              {m}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={entries.length === 0 ? "Your journal is empty" : "No matching entries"}
          description={
            entries.length === 0
              ? "Practice first, then capture how you feel — or write a few words anytime."
              : "Try a different search or mood filter."
          }
          testId="empty-journal"
        >
          {entries.length === 0 && (
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <Button asChild data-testid="button-journal-start-practice">
                <Link href="/guided">
                  <Timer className="mr-1.5 h-4 w-4" /> Start a practice
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(emptyDraft);
                  setOpen(true);
                }}
                data-testid="button-first-entry"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Write an entry
              </Button>
            </div>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            let tags: string[] = [];
            try { tags = JSON.parse(e.tags || "[]"); } catch { tags = []; }
            const MoodIcon = e.mood ? MOOD_ICONS[e.mood as Mood] : null;
            return (
              <Card
                key={e.id}
                className="cursor-pointer shadow-soft hover-elevate"
                onClick={() => openEdit(e)}
                data-testid={`card-journal-${e.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif text-lg">{e.title || "Untitled"}</h3>
                        {MoodIcon && (
                          <Badge variant="outline" className="gap-1">
                            <MoodIcon className="h-3 w-3" /> {e.mood}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{formatShortDate(e.date)}</p>
                    </div>
                    <button
                      onClick={(ev) => { ev.stopPropagation(); setDeleteId(e.id); }}
                      className="text-muted-foreground hover:text-destructive"
                      data-testid={`button-delete-${e.id}`}
                      aria-label="Delete entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {e.body && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{e.body}</p>}
                  {tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">#{t}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">{draft.id ? "Edit entry" : "New journal entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Title (optional)"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              data-testid="input-entry-title"
            />
            <Textarea
              placeholder="How was your practice? What are you noticing?"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={5}
              data-testid="input-entry-body"
            />
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Mood</p>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((m) => {
                  const Icon = MOOD_ICONS[m];
                  const active = draft.mood === m;
                  return (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => setDraft({ ...draft, mood: active ? "" : m })}
                      data-testid={`chip-mood-${m.toLowerCase()}`}
                    >
                      <Icon className="mr-1.5 h-4 w-4" /> {m}
                    </Button>
                  );
                })}
              </div>
            </div>
            <Input
              placeholder="Tags, comma-separated (e.g. hips, evening)"
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              data-testid="input-entry-tags"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-entry">Cancel</Button>
            <Button
              onClick={() => save.mutate(draft)}
              disabled={save.isPending || (!draft.body && !draft.title)}
              data-testid="button-save-entry"
            >
              Save entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && remove.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
