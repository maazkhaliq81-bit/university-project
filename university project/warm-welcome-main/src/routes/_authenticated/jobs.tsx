import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "./route";
import { generateJobMatches, listJobs } from "@/lib/features.functions";
import { toast } from "sonner";
import { Briefcase, Loader2, ExternalLink, MapPin, Building2, Clock, DollarSign, BadgeCheck, Linkedin, LayoutGrid, Columns3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => ({
    meta: [
      { title: "Jobs · Automated Recommendation System" },
      { name: "description", content: "Job matches filtered by your assessed skill level with direct apply links." },
      { property: "og:title", content: "Jobs · Automated Recommendation System" },
      { property: "og:description", content: "AI-curated openings with LinkedIn, Indeed & Glassdoor apply links." },
    ],
  }),
  component: JobsPage,
});

type ApplyLink = { source: string; url: string };
type Job = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  level: string | null;
  employment_type: string | null;
  experience: string | null;
  salary_range: string | null;
  fit_score: number | null;
  skills: string[];
  description: string | null;
  url: string | null;
  apply_links: ApplyLink[];
  application_status?: string | null;
};

type KanbanStatus = "matched" | "applied" | "recruiter_responded" | "interviewing";
const KANBAN_COLUMNS: { id: KanbanStatus; label: string }[] = [
  { id: "matched", label: "Matched" },
  { id: "applied", label: "Applied" },
  { id: "recruiter_responded", label: "Recruiter Responded" },
  { id: "interviewing", label: "Interviewing" },
];

const openExternal = (url: string) => {
  try {
    const w = window.top ?? window;
    w.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

function JobsPage() {
  const gen = useServerFn(generateJobMatches);
  const list = useServerFn(listJobs);
  const qc = useQueryClient();
  const [role, setRole] = useState("");
  const [level, setLevel] = useState("beginner");
  const [skills, setSkills] = useState("");
  const [view, setView] = useState<"card" | "kanban">("card");
  const { data: jobs } = useQuery({ queryKey: ["jobs"], queryFn: () => list() });

  const mut = useMutation({
    mutationFn: () => gen({ data: { targetRole: role, level, skills } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); toast.success("Matched"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <PageShell title="Job Matcher" subtitle="Curated roles with direct apply links on LinkedIn, Indeed, Glassdoor & Wellfound.">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-panel">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[200px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Target role</span>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Backend Engineer" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ember" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Level</span>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option>beginner</option><option>intermediate</option><option>advanced</option>
            </select>
          </label>
          <label className="min-w-[200px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Skills (optional)</span>
            <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Node, Postgres, Docker" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ember" />
          </label>
          <button disabled={!role || mut.isPending} onClick={() => mut.mutate()} className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm text-cream disabled:opacity-50">
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />} Find matches
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end">
        <div className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-sm">
          <button
            onClick={() => setView("card")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${view === "card" ? "bg-ink text-cream" : "text-muted-foreground hover:text-foreground"}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Card View
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${view === "kanban" ? "bg-ink text-cream" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Columns3 className="h-3.5 w-3.5" /> Kanban Board
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <KanbanBoard jobs={(jobs ?? []) as Job[]} onMoved={() => qc.invalidateQueries({ queryKey: ["jobs"] })} />
      ) : (
      <div className="mt-6 grid gap-4">
        {((jobs ?? []) as Job[]).map((j) => {
          const linkedin = j.apply_links?.find((l) => l.source === "LinkedIn");
          const alternates = (j.apply_links ?? []).filter((l) => l.source !== "LinkedIn");
          return (
            <div key={j.id} className="group rounded-2xl border border-border bg-card p-6 shadow-panel transition hover:border-ember/40 hover:shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold leading-tight">{j.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {j.company && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{j.company}</span>}
                    {j.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{j.location}</span>}
                    {j.employment_type && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{j.employment_type}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <div className="display text-3xl leading-none text-ember">{j.fit_score}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">fit score</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {j.experience && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1">
                    <BadgeCheck className="h-3 w-3" /> {j.experience}
                  </span>
                )}
                {j.salary_range && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1">
                    <DollarSign className="h-3 w-3" /> {j.salary_range}
                  </span>
                )}
                {j.level && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 capitalize">
                    {j.level}
                  </span>
                )}
              </div>

              {j.description && <p className="mt-3 text-sm leading-relaxed text-foreground/80">{j.description}</p>}

              {j.skills?.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Required skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {j.skills.map((s) => <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs">{s}</span>)}
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                {linkedin && (
                  <button
                    onClick={() => openExternal(linkedin.url)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#0A66C2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0a5aad]"
                  >
                    <Linkedin className="h-4 w-4" /> Apply on LinkedIn
                    <ExternalLink className="h-3 w-3 opacity-80" />
                  </button>
                )}
                {alternates.map((l) => (
                  <button
                    key={l.source}
                    onClick={() => openExternal(l.url)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-foreground/80 transition hover:border-ember/40 hover:text-foreground"
                  >
                    {l.source} <ExternalLink className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {(!jobs || jobs.length === 0) && <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No matches yet. Enter a target role above.</div>}
      </div>
      )}
    </PageShell>
  );
}

function KanbanBoard({ jobs, onMoved }: { jobs: Job[]; onMoved: () => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<KanbanStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function move(jobId: string, status: KanbanStatus) {
    setBusy(jobId);
    const { error } = await supabase
      .from("job_matches")
      .update({ application_status: status } as never)
      .eq("id", jobId);
    setBusy(null);
    if (error) {
      toast.error("Could not update status");
      return;
    }
    toast.success(`Moved to ${status.replace(/_/g, " ")}`);
    onMoved();
  }

  const grouped: Record<KanbanStatus, Job[]> = {
    matched: [], applied: [], recruiter_responded: [], interviewing: [],
  };
  for (const j of jobs) {
    const s = (j.application_status as KanbanStatus) || "matched";
    (grouped[s] ?? grouped.matched).push(j);
  }

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {KANBAN_COLUMNS.map((col) => (
        <div
          key={col.id}
          onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
          onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
          onDrop={(e) => {
            e.preventDefault();
            setOverCol(null);
            if (dragId) move(dragId, col.id);
            setDragId(null);
          }}
          className={`flex min-h-[240px] flex-col rounded-2xl border bg-card p-3 shadow-panel transition ${overCol === col.id ? "border-ember/60 ring-2 ring-ember/20" : "border-border"}`}
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{col.label}</div>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{grouped[col.id].length}</span>
          </div>
          <div className="flex-1 space-y-2">
            {grouped[col.id].map((j) => (
              <div
                key={j.id}
                draggable
                onDragStart={() => setDragId(j.id)}
                onDragEnd={() => setDragId(null)}
                className={`cursor-grab rounded-xl border border-border bg-background p-3 shadow-sm transition hover:border-ember/40 active:cursor-grabbing ${busy === j.id ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{j.title}</div>
                    {j.company && <div className="truncate text-xs text-muted-foreground">{j.company}</div>}
                  </div>
                  {j.fit_score != null && (
                    <div className="text-right">
                      <div className="display text-lg leading-none text-ember">{j.fit_score}</div>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">fit</div>
                    </div>
                  )}
                </div>
                {j.location && (
                  <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {j.location}
                  </div>
                )}
              </div>
            ))}
            {grouped[col.id].length === 0 && (
              <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-[11px] text-muted-foreground">
                Drop cards here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
