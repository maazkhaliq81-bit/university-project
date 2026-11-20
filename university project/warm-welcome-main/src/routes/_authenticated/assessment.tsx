import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageShell } from "./route";
import {
  generateAssessment,
  submitAssessment,
  listAssessments,
  recommendWeakSkillResources,
  generateRoadmap,
} from "@/lib/features.functions";
import { toast } from "sonner";
import {
  BookOpen,
  ClipboardList,
  ExternalLink,
  Hammer,
  Loader2,
  Map as MapIcon,
  PlayCircle,
  Sparkles,
  Target,
} from "lucide-react";
import { AgentModeButton } from "@/components/AgentMode";

export const Route = createFileRoute("/_authenticated/assessment")({
  head: () => ({
    meta: [
      { title: "Skills Assessment · Automated Recommendation System" },
      { name: "description", content: "Baseline your current knowledge with an AI-graded questionnaire." },
      { property: "og:title", content: "Skills Assessment · Automated Recommendation System" },
      { property: "og:description", content: "10-question adaptive baseline for your target role." },
    ],
  }),
  component: AssessmentPage,
});

type Q = { id: string; question: string; concept: string; options: string[] };

type WeakSkillPack = {
  concept: string;
  priority: "high" | "medium" | "low";
  estimated_hours: number;
  why_it_matters: string;
  videos: {
    title: string;
    channel: string;
    duration: string;
    url: string;
    videoId: string | null;
    thumbnail: string | null;
  }[];
  docs: { title: string; url: string }[];
  practice: { title: string; url: string }[];
  projects: { title: string; description: string }[];
};

function openInNewBrowserTab(url: string) {
  try {
    const w = (window.top ?? window).open(url, "_blank", "noopener,noreferrer");
    if (w) return;
  } catch {
    /* fall through */
  }
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function AssessmentPage() {
  const gen = useServerFn(generateAssessment);
  const sub = useServerFn(submitAssessment);
  const list = useServerFn(listAssessments);
  const recommend = useServerFn(recommendWeakSkillResources);
  const buildRoadmap = useServerFn(generateRoadmap);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [role, setRole] = useState("");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const { data: history } = useQuery({ queryKey: ["assessments"], queryFn: () => list() });
  const latest = history?.[0] as
    | {
        level: string;
        verdict: { score: number; summary: string; weak_concepts: string[]; strong_concepts: string[] };
        target_role: string;
      }
    | undefined;

  const weakConcepts = useMemo(
    () => (latest?.verdict?.weak_concepts ?? []).filter(Boolean).slice(0, 8),
    [latest],
  );

  const genMut = useMutation({
    mutationFn: () => gen({ data: { targetRole: role } }),
    onSuccess: (qs) => {
      setQuestions(qs);
      setAnswers({});
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const subMut = useMutation({
    mutationFn: () =>
      sub({
        data: {
          targetRole: role,
          questions,
          answers: Object.entries(answers).map(([id, choice]) => ({ id, choice })),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessments"] });
      setQuestions([]);
      toast.success("Graded!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const recMut = useMutation({
    mutationFn: () =>
      recommend({ data: { targetRole: latest!.target_role, weakConcepts } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const roadmapMut = useMutation({
    mutationFn: () =>
      buildRoadmap({
        data: {
          targetRole: `${latest!.target_role} — focus areas: ${weakConcepts.join(", ")}`,
          level: latest!.level,
        },
      }),
    onSuccess: () => {
      toast.success("Focused roadmap generated");
      navigate({ to: "/roadmap" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <PageShell title="Skills Assessment" subtitle="A quick baseline questionnaire — Automated Recommendation System grades it and detects your level.">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-gradient-to-br from-ember/5 to-transparent p-4">
        <div>
          <div className="text-sm font-semibold">Prefer to talk it out?</div>
          <p className="text-xs text-muted-foreground">Have a natural voice chat with Automated Recommendation System in English or Urdu — she'll recommend a field for you.</p>
        </div>
        <AgentModeButton />
      </div>
      {questions.length === 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-panel">
            <h2 className="text-lg font-semibold">Start a new assessment</h2>
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Target role</span>
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Frontend Developer" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ember" />
            </label>
            <button disabled={!role || genMut.isPending} onClick={() => genMut.mutate()} className="mt-4 flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm text-cream disabled:opacity-50">
              {genMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
              Generate questions
            </button>
          </div>
          <div>
            {latest ? (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-panel">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold">{latest.target_role}</h2>
                  <div className="display text-4xl text-ember">{latest.verdict.score}</div>
                </div>
                <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">Level: {latest.level}</p>
                <p className="mt-3 text-sm">{latest.verdict.summary}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs font-semibold text-muted-foreground">Strong</div><ul className="mt-1 list-disc pl-4">{latest.verdict.strong_concepts?.map((c) => <li key={c}>{c}</li>)}</ul></div>
                  <div><div className="text-xs font-semibold text-muted-foreground">Weak</div><ul className="mt-1 list-disc pl-4">{latest.verdict.weak_concepts?.map((c) => <li key={c}>{c}</li>)}</ul></div>
                </div>
              </div>
            ) : (
              <div className="grid h-full place-items-center rounded-2xl border border-dashed border-border p-12 text-sm text-muted-foreground">Your assessment results appear here.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-panel">
          <h2 className="text-lg font-semibold">Answer {questions.length} questions</h2>
          <ol className="mt-4 space-y-5">
            {questions.map((q, i) => (
              <li key={q.id} className="rounded-lg border border-border p-4">
                <div className="text-sm font-medium">{i + 1}. {q.question}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{q.concept}</div>
                <div className="mt-3 grid gap-2">
                  {q.options.map((opt) => (
                    <label key={opt} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${answers[q.id] === opt ? "border-ember bg-ember/5" : "border-border hover:bg-muted"}`}>
                      <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => setAnswers({ ...answers, [q.id]: opt })} />
                      {opt}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <button disabled={Object.keys(answers).length !== questions.length || subMut.isPending} onClick={() => subMut.mutate()} className="mt-5 flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm text-cream disabled:opacity-50">
            {subMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit for grading
          </button>
        </div>
      )}

      {questions.length === 0 && latest && weakConcepts.length > 0 && (
        <RecommendedResources
          role={latest.target_role}
          weakConcepts={weakConcepts}
          packs={recMut.data as WeakSkillPack[] | undefined}
          isLoading={recMut.isPending}
          onGenerate={() => recMut.mutate()}
          onFocusedRoadmap={() => roadmapMut.mutate()}
          roadmapLoading={roadmapMut.isPending}
        />
      )}
    </PageShell>
  );
}

function RecommendedResources({
  role,
  weakConcepts,
  packs,
  isLoading,
  onGenerate,
  onFocusedRoadmap,
  roadmapLoading,
}: {
  role: string;
  weakConcepts: string[];
  packs: WeakSkillPack[] | undefined;
  isLoading: boolean;
  onGenerate: () => void;
  onFocusedRoadmap: () => void;
  roadmapLoading: boolean;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display text-2xl">Recommended Learning Resources</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Coach-picked videos, docs, practice sites and mini-projects for every weak concept from your latest {role} assessment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!packs && (
            <button
              onClick={onGenerate}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm text-cream disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate recommendations
            </button>
          )}
          <button
            onClick={onFocusedRoadmap}
            disabled={roadmapLoading}
            className="flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm hover:border-ember disabled:opacity-50"
          >
            {roadmapLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapIcon className="h-4 w-4" />}
            Build focused roadmap
          </button>
        </div>
      </div>

      {!packs && !isLoading && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          Weak concepts detected: <span className="font-medium text-foreground">{weakConcepts.join(", ")}</span>. Generate a curated resource pack for each one.
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {weakConcepts.map((c) => (
            <div key={c} className="h-56 animate-pulse rounded-2xl border border-border bg-muted/40" />
          ))}
        </div>
      )}

      {packs && (
        <div className="space-y-6">
          {packs.map((pack) => (
            <ResourcePackCard key={pack.concept} pack={pack} />
          ))}
        </div>
      )}
    </section>
  );
}

const priorityStyles: Record<WeakSkillPack["priority"], string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-ember/15 text-ember border-ember/30",
  low: "bg-muted text-muted-foreground border-border",
};

function ResourcePackCard({ pack }: { pack: WeakSkillPack }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-6 shadow-panel">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{pack.concept}</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{pack.why_it_matters}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${priorityStyles[pack.priority]}`}>
            <Target className="mr-1 inline h-3 w-3" />
            {pack.priority} priority
          </span>
          <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted-foreground">
            ~{pack.estimated_hours}h to competency
          </span>
        </div>
      </header>

      <Group icon={<PlayCircle className="h-4 w-4" />} title="Videos">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pack.videos.map((v, i) => (
            <button
              key={`${v.url}-${i}`}
              onClick={() => openInNewBrowserTab(v.url)}
              className="group flex flex-col overflow-hidden rounded-lg border border-border bg-background text-left transition hover:border-ember"
            >
              <div className="relative aspect-video w-full bg-muted">
                {v.thumbnail ? (
                  <img src={v.thumbnail} alt={v.title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <PlayCircle className="h-8 w-8" />
                  </div>
                )}
                <span className="absolute bottom-1.5 right-1.5 rounded bg-ink/85 px-1.5 py-0.5 text-[10px] font-medium text-cream">
                  {v.duration || "video"}
                </span>
                <span className="absolute inset-0 grid place-items-center bg-ink/0 transition group-hover:bg-ink/30">
                  <PlayCircle className="h-10 w-10 text-cream opacity-0 transition group-hover:opacity-100" />
                </span>
              </div>
              <div className="p-3">
                <div className="line-clamp-2 text-sm font-medium">{v.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{v.channel}</div>
              </div>
            </button>
          ))}
        </div>
      </Group>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Group icon={<BookOpen className="h-4 w-4" />} title="Official docs">
          <ul className="space-y-1.5 text-sm">
            {pack.docs.map((d, i) => (
              <li key={`${d.url}-${i}`}>
                <button
                  onClick={() => openInNewBrowserTab(d.url)}
                  className="inline-flex items-center gap-1.5 text-left underline-offset-2 hover:text-ember hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {d.title}
                </button>
              </li>
            ))}
          </ul>
        </Group>
        <Group icon={<Target className="h-4 w-4" />} title="Practice">
          <ul className="space-y-1.5 text-sm">
            {pack.practice.map((p, i) => (
              <li key={`${p.url}-${i}`}>
                <button
                  onClick={() => openInNewBrowserTab(p.url)}
                  className="inline-flex items-center gap-1.5 text-left underline-offset-2 hover:text-ember hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {p.title}
                </button>
              </li>
            ))}
          </ul>
        </Group>
        <Group icon={<Hammer className="h-4 w-4" />} title="Suggested projects">
          <ol className="list-decimal space-y-1.5 pl-4 text-sm">
            {pack.projects.map((pr, i) => (
              <li key={i}>
                <span className="font-medium">{pr.title}</span>
                <span className="text-muted-foreground"> — {pr.description}</span>
              </li>
            ))}
          </ol>
        </Group>
      </div>
    </article>
  );
}

function Group({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
