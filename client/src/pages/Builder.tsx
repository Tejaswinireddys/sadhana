import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { ASANAS, CATEGORIES, asanaBySlug, type Category, type Asana } from "@/data/content";
import { usePractice } from "@/context/PracticeContext";
import type { CustomFlow } from "@shared/schema";
import {
  PlusCircle,
  Play,
  Pencil,
  Trash2,
  Clock,
  ArrowUp,
  ArrowDown,
  X,
  Plus,
  Search,
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const MAX_POSES = 20;

// A pose entry inside a sequence being built.
type SeqPose = { slug: string; holdSeconds: number; sides: "once" | "each" };

function parseSequence(json: string): SeqPose[] {
  try {
    const arr = JSON.parse(json) as Array<{ slug: string; holdSeconds?: number; sides?: string }>;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p) => p && typeof p.slug === "string" && asanaBySlug(p.slug))
      .map((p) => ({
        slug: p.slug,
        holdSeconds: typeof p.holdSeconds === "number" ? p.holdSeconds : 30,
        sides: p.sides === "each" ? "each" : "once",
      }));
  } catch {
    return [];
  }
}

function totalSeconds(poses: SeqPose[]): number {
  return poses.reduce((sum, p) => sum + p.holdSeconds * (p.sides === "each" ? 2 : 1), 0);
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}

/* ------------------------------------------------------------------ */
/* Flow card (My Flows list)                                          */
/* ------------------------------------------------------------------ */

function FlowCard({
  flow,
  onStart,
  onEdit,
  onDelete,
}: {
  flow: CustomFlow;
  onStart: (f: CustomFlow) => void;
  onEdit: (f: CustomFlow) => void;
  onDelete: (f: CustomFlow) => void;
}) {
  const poses = useMemo(() => parseSequence(flow.poseSequence), [flow.poseSequence]);
  const secs = totalSeconds(poses);
  const thumbs = poses.slice(0, 5);

  return (
    <Card className="shadow-soft" data-testid={`card-flow-${flow.id}`}>
      <CardContent className="space-y-4 p-5">
        <div className="space-y-1">
          <h3 className="font-serif text-lg" data-testid={`text-flow-name-${flow.id}`}>
            {flow.name}
          </h3>
          {flow.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{flow.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {thumbs.map((p, i) => (
            <span
              key={`${p.slug}-${i}`}
              className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-accent/30"
            >
              <img
                src={`${import.meta.env.BASE_URL}poses/${p.slug}.png`}
                alt={asanaBySlug(p.slug)?.english ?? p.slug}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </span>
          ))}
          {poses.length > 5 && (
            <span className="text-xs text-muted-foreground">+{poses.length - 5}</span>
          )}
          {poses.length === 0 && (
            <span className="text-xs text-muted-foreground">No poses yet</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" /> ~{fmtTime(secs)}
          </Badge>
          <span>
            {poses.length} {poses.length === 1 ? "pose" : "poses"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => onStart(flow)}
            disabled={poses.length === 0}
            data-testid={`button-start-flow-${flow.id}`}
          >
            <Play className="mr-1.5 h-4 w-4" /> Start
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(flow)}
            data-testid={`button-edit-flow-${flow.id}`}
          >
            <Pencil className="mr-1.5 h-4 w-4" /> Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(flow)}
            data-testid={`button-delete-flow-${flow.id}`}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Builder view (create / edit)                                       */
/* ------------------------------------------------------------------ */

function BuilderView({
  editing,
  onCancel,
  onSaved,
}: {
  editing: CustomFlow | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [sequence, setSequence] = useState<SeqPose[]>(
    editing ? parseSequence(editing.poseSequence) : [],
  );

  // Library filters (reuse the same chip filters as the Asana Library).
  const [category, setCategory] = useState<Category | "All">("All");
  const [level, setLevel] = useState<"All" | Asana["difficulty"]>("All");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return ASANAS.filter((a) => {
      if (category !== "All" && a.category !== category) return false;
      if (level !== "All" && a.difficulty !== level) return false;
      if (q.trim()) {
        const t = q.trim().toLowerCase();
        if (
          !a.english.toLowerCase().includes(t) &&
          !a.sanskrit.toLowerCase().includes(t)
        )
          return false;
      }
      return true;
    });
  }, [category, level, q]);

  const secs = totalSeconds(sequence);
  const atCap = sequence.length >= MAX_POSES;

  const addPose = (slug: string) => {
    if (atCap) {
      toast({ title: `Max ${MAX_POSES} poses`, description: "Remove one to add another." });
      return;
    }
    setSequence((prev) => [...prev, { slug, holdSeconds: 30, sides: "once" }]);
  };
  const removePose = (i: number) => setSequence((prev) => prev.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    setSequence((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const setHold = (i: number, v: number) =>
    setSequence((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, holdSeconds: Math.max(1, v || 1) } : p)),
    );
  const toggleSides = (i: number) =>
    setSequence((prev) =>
      prev.map((p, idx) =>
        idx === i ? { ...p, sides: p.sides === "each" ? "once" : "each" } : p,
      ),
    );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        poseSequence: JSON.stringify(sequence),
      };
      if (editing) {
        return apiRequest("PUT", `/api/custom-flows/${editing.id}`, payload);
      }
      return apiRequest("POST", "/api/custom-flows", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-flows"] });
      toast({ title: editing ? "Flow updated" : "Flow saved", description: name.trim() });
      onSaved();
    },
    onError: (e: Error) => {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    },
  });

  const canSave = name.trim().length > 0 && sequence.length > 0 && !saveMutation.isPending;

  return (
    <div className="animate-fade-in space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <PlusCircle className="h-5 w-5" />
          <span className="text-xs font-medium uppercase tracking-wide">Sequence Builder</span>
        </div>
        <h1 className="font-serif text-2xl">
          {editing ? "Edit your flow" : "Create a new flow"}
        </h1>
      </header>

      {/* Name + description */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="flow-name">Flow name *</Label>
          <Input
            id="flow-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My morning wake-up"
            data-testid="input-flow-name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="flow-desc">Description (optional)</Label>
          <Textarea
            id="flow-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short note about this sequence"
            className="min-h-[40px]"
            data-testid="input-flow-description"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- Left: asana library ---- */}
        <section className="space-y-3" data-testid="panel-library">
          <h2 className="font-serif text-lg">Add poses</h2>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search poses…"
              className="pl-9"
              data-testid="input-search-poses"
            />
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5">
            {(["All", ...CATEGORIES] as (Category | "All")[]).map((c) => (
              <Button
                key={c}
                size="sm"
                variant={category === c ? "default" : "outline"}
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => setCategory(c)}
                data-testid={`chip-category-${c}`}
              >
                {c}
              </Button>
            ))}
          </div>
          {/* Level chips */}
          <div className="flex flex-wrap gap-1.5">
            {(["All", "Beginner", "Intermediate", "Advanced"] as const).map((l) => (
              <Button
                key={l}
                size="sm"
                variant={level === l ? "default" : "outline"}
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => setLevel(l)}
                data-testid={`chip-level-${l}`}
              >
                {l}
              </Button>
            ))}
          </div>

          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {filtered.map((a) => (
              <div
                key={a.slug}
                className="flex items-center gap-3 rounded-md border border-border bg-background p-2"
                data-testid={`library-pose-${a.slug}`}
              >
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-accent/30">
                  <img
                    src={`${import.meta.env.BASE_URL}poses/${a.slug}.png`}
                    alt={a.english}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.english}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.category} · {a.difficulty}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => addPose(a.slug)}
                  disabled={atCap}
                  aria-label={`Add ${a.english}`}
                  data-testid={`button-add-pose-${a.slug}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No poses match those filters.
              </p>
            )}
          </div>
        </section>

        {/* ---- Right: sequence being built ---- */}
        <section className="space-y-3" data-testid="panel-sequence">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg">Your sequence</h2>
            <Badge variant="outline" className="gap-1" data-testid="text-total-time">
              <Clock className="h-3 w-3" /> ~{fmtTime(secs)}
            </Badge>
          </div>

          {sequence.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
              Add poses from the library to build your flow.
            </div>
          ) : (
            <div className="space-y-2">
              {sequence.map((p, i) => {
                const asana = asanaBySlug(p.slug);
                return (
                  <div
                    key={`${p.slug}-${i}`}
                    className="flex items-center gap-3 rounded-md border border-border bg-background p-2"
                    data-testid={`seq-pose-${i}`}
                  >
                    <span className="flex flex-col">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                        data-testid={`button-move-up-${i}`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => move(i, 1)}
                        disabled={i === sequence.length - 1}
                        aria-label="Move down"
                        data-testid={`button-move-down-${i}`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-accent/30">
                      <img
                        src={`${import.meta.env.BASE_URL}poses/${p.slug}.png`}
                        alt={asana?.english ?? p.slug}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{asana?.english ?? p.slug}</p>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            value={p.holdSeconds}
                            onChange={(e) => setHold(i, Number(e.target.value))}
                            className="h-7 w-16 px-2 text-xs"
                            aria-label="Hold seconds"
                            data-testid={`input-hold-${i}`}
                          />
                          <span className="text-xs text-muted-foreground">sec</span>
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Switch
                            checked={p.sides === "each"}
                            onCheckedChange={() => toggleSides(i)}
                            data-testid={`switch-sides-${i}`}
                          />
                          each side
                        </label>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removePose(i)}
                      aria-label="Remove pose"
                      data-testid={`button-remove-pose-${i}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {sequence.length}/{MAX_POSES} poses
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!canSave}
              data-testid="button-save-flow"
            >
              {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Save flow"}
            </Button>
            <Button variant="outline" onClick={onCancel} data-testid="button-cancel-flow">
              Cancel
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function Builder() {
  useDocumentTitle("Builder · Sadhana");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { loadSession } = usePractice();
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [editing, setEditing] = useState<CustomFlow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomFlow | null>(null);

  const { data: flows = [], isLoading } = useQuery<CustomFlow[]>({
    queryKey: ["/api/custom-flows"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/custom-flows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-flows"] });
      toast({ title: "Flow deleted" });
      setPendingDelete(null);
    },
  });

  const startFlow = (flow: CustomFlow) => {
    const seq = parseSequence(flow.poseSequence);
    const poses = seq
      .map((p) => {
        const asana = asanaBySlug(p.slug);
        return asana ? { asana, holdSeconds: p.holdSeconds, sides: p.sides } : null;
      })
      .filter(
        (
          x,
        ): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number; sides: "once" | "each" } =>
          x != null,
      );
    if (poses.length === 0) {
      toast({ title: "This flow has no poses yet", variant: "destructive" });
      return;
    }
    // Best-effort touch of lastUsedAt (fire and forget).
    apiRequest("PUT", `/api/custom-flows/${flow.id}`, {
      lastUsedAt: new Date().toISOString(),
    }).catch(() => {});
    loadSession(poses, { label: flow.name });
    toast({ title: `${flow.name} loaded`, description: `${poses.length} poses queued.` });
    navigate("/guided");
  };

  if (mode === "edit") {
    return (
      <BuilderView
        editing={editing}
        onCancel={() => {
          setMode("list");
          setEditing(null);
        }}
        onSaved={() => {
          setMode("list");
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <PlusCircle className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-wide">Sequence Builder</span>
          </div>
          <h1 className="font-serif text-2xl">My Flows</h1>
          <p className="text-sm text-muted-foreground">
            Build your own yoga sequences, pose by pose — then practice them guided.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setMode("edit");
          }}
          data-testid="button-create-flow"
        >
          <PlusCircle className="mr-1.5 h-4 w-4" /> Create New Flow
        </Button>
      </header>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-48 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : flows.length === 0 ? (
        <EmptyState
          title="No custom flows yet"
          description="Create your first sequence — pick poses, set hold times, and reorder to taste."
          testId="empty-flows"
        >
          <Button
            onClick={() => {
              setEditing(null);
              setMode("edit");
            }}
            data-testid="button-create-flow-empty"
          >
            <PlusCircle className="mr-1.5 h-4 w-4" /> Create New Flow
          </Button>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="grid-flows">
          {flows.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onStart={startFlow}
              onEdit={(f) => {
                setEditing(f);
                setMode("edit");
              }}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <AlertDialog open={pendingDelete != null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this flow?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.name}" will be permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
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
