import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageShell } from "./route";
import {
  generateRoadmap,
  listRoadmap,
  setRoadmapStatus,
  toggleSubtopicComplete,
  generateQuiz,
  submitQuiz,
} from "@/lib/features.functions";
import { toast } from "sonner";
import {
  Map,
  Loader2,
  Circle,
  PlayCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Filter,
  Youtube,
  BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap · Automated Recommendation System" },
      { name: "description", content: "Your personalized learning roadmap with expandable phases, curated resources, and inline quizzes." },
      { property: "og:title", content: "Roadmap · Automated Recommendation System" },
      { property: "og:description", content: "A step-by-step path to your target role with sub-topics and progress tracking." },
    ],
  }),
  component: RoadmapPage,
});

type Resource = { title: string; url: string; source: "youtube" | "web"; difficulty: "beginner" | "intermediate" | "advanced"; duration: string; description: string };
type SubTopic = { id: string; title: string; description: string; completed: boolean; resources: Resource[] };
type Item = {
  id: string;
  topic: string;
  description: string | null;
  status: "todo" | "doing" | "done";
  estimated_weeks: number | null;
  position: number;
  sub_topics: SubTopic[] | null;
};
type QuizQ = { id: string; question: string; options: string[]; correct: string; concept: string; explanation: string };

const YOUTUBE_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

function extractYoutubeVideoId(url: string): string | null {
  const raw = url.trim();
  const match = raw.match(/(?:youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (match?.[1] && YOUTUBE_VIDEO_ID.test(match[1])) return match[1];

  try {
    const parsed = new URL(raw);
    const id = parsed.searchParams.get("v");
    return id && YOUTUBE_VIDEO_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

function getYoutubeWatchUrl(url: string): string | null {
  const videoId = extractYoutubeVideoId(url);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

function openInNewBrowserTab(url: string) {
  let opened: Window | null = null;

  try {
    opened = window.top?.open(url, "_blank") ?? null;
  } catch {
    opened = window.open(url, "_blank");
  }

  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  try {
    opened.opener = null;
    opened.focus();
  } catch {
    // The tab was opened; cross-origin window handles may reject follow-up access.
  }
}

function RoadmapPage() {
  const gen = useServerFn(generateRoadmap);
  const list = useServerFn(listRoadmap);
  const updStatus = useServerFn(setRoadmapStatus);
  const toggleSub = useServerFn(toggleSubtopicComplete);
  const genQuiz = useServerFn(generateQuiz);
  const subQuiz = useServerFn(submitQuiz);
  const qc = useQueryClient();

  const [role, setRole] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"all" | "incomplete" | "in_progress" | "done">("all");
  const [search, setSearch] = useState("");
  const [quizFor, setQuizFor] = useState<string | null>(null); // subtopic id
  const [quiz, setQuiz] = useState<{ id: string; questions: QuizQ[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; weak_concepts: { concept: string; wrong: number; total: number }[] } | null>(null);

  const { data: items } = useQuery({ queryKey: ["roadmap"], queryFn: () => list() });
  const raw = (items ?? []) as Item[];

  const filtered = useMemo(() => {
    return raw.filter((i) => {
      if (search && !i.topic.toLowerCase().includes(search.toLowerCase()) && !(i.description ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "incomplete") return i.status !== "done";
      if (filter === "in_progress") return i.status === "doing";
      if (filter === "done") return i.status === "done";
      return true;
    });
  }, [raw, filter, search]);

  const overall = useMemo(() => {
    const allSubs = raw.flatMap((i) => i.sub_topics ?? []);
    if (allSubs.length === 0) {
      const done = raw.filter((i) => i.status === "done").length;
      return { done, total: raw.length, pct: raw.length ? Math.round((done / raw.length) * 100) : 0 };
    }
    const done = allSubs.filter((s) => s.completed).length;
    return { done, total: allSubs.length, pct: Math.round((done / allSubs.length) * 100) };
  }, [raw]);

  const genMut = useMutation({
    mutationFn: () => gen({ data: { targetRole: role } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roadmap"] });
      toast.success("Roadmap generated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const cyclePhase = (i: Item) => {
    const next = i.status === "todo" ? "doing" : i.status === "doing" ? "done" : "todo";
    updStatus({ data: { id: i.id, status: next } }).then(() => qc.invalidateQueries({ queryKey: ["roadmap"] }));
  };

  const toggleSubtopic = (itemId: string, sub: SubTopic) => {
    toggleSub({ data: { itemId, subtopicId: sub.id, completed: !sub.completed } })
      .then(() => qc.invalidateQueries({ queryKey: ["roadmap"] }))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
  };

  const startQuiz = (sub: SubTopic) => {
    setQuizFor(sub.id);
    setQuiz(null);
    setAnswers({});
    setResult(null);
    genQuiz({ data: { topic: sub.title, context: sub.description } })
      .then((q) => setQuiz({ id: q.id, questions: q.questions as QuizQ[] }))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
  };

  const gradeQuiz = () => {
    if (!quiz) return;
    subQuiz({ data: { quizId: quiz.id, answers: Object.entries(answers).map(([id, choice]) => ({ id, choice })) } })
      .then((r) => setResult({ score: r.score ?? 0, weak_concepts: (r.weak_concepts as { concept: string; wrong: number; total: number }[]) ?? [] }))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
  };

  return (
    <PageShell title="Roadmap" subtitle="A visual, expandable path from where you are to the role you want.">
      {/* Generator */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-panel">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Career path or field</span>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Data Analyst, Full Stack Developer, ML Engineer..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ember"
            />
          </label>
          <button
            disabled={!role || genMut.isPending}
            onClick={() => genMut.mutate()}
            className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm text-cream disabled:opacity-50"
          >
            {genMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Map className="h-4 w-4" />}
            Generate roadmap
          </button>
        </div>

        {raw.length > 0 && (
          <div className="mt-5">
            <div className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground">
              <span>{overall.done} of {overall.total} sub-topics complete</span>
              <span className="font-semibold text-ink">{overall.pct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-gradient-to-r from-ember to-moss transition-all" style={{ width: `${overall.pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      {raw.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-panel">
          <Filter className="ml-1 h-4 w-4 text-muted-foreground" />
          {(["all", "incomplete", "in_progress", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs capitalize ${filter === f ? "bg-ink text-cream" : "border border-border hover:bg-muted"}`}
            >
              {f.replace("_", " ")}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search phase..."
            className="ml-auto w-48 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ember"
          />
        </div>
      )}

      {/* Phases */}
      <ol className="mt-6 space-y-3">
        {filtered.map((i, idx) => {
          const subs = i.sub_topics ?? [];
          const doneCount = subs.filter((s) => s.completed).length;
          const pct = subs.length ? Math.round((doneCount / subs.length) * 100) : i.status === "done" ? 100 : 0;
          const isOpen = expanded[i.id];
          return (
            <li key={i.id} className="rounded-2xl border border-border bg-card shadow-panel">
              {/* Phase header */}
              <button
                onClick={() => setExpanded((e) => ({ ...e, [i.id]: !e[i.id] }))}
                className="flex w-full items-start gap-4 p-4 text-left"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold">{idx + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div className="font-medium">{i.topic}</div>
                    {i.estimated_weeks ? <span className="text-xs text-muted-foreground">· ~{i.estimated_weeks}w</span> : null}
                  </div>
                  <div className="mt-0.5 pl-6 text-sm text-muted-foreground">{i.description}</div>
                  {subs.length > 0 && (
                    <div className="mt-2 pl-6">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-ember" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="tabular-nums">{doneCount}/{subs.length}</span>
                      </div>
                    </div>
                  )}
                </div>
                <span
                  onClick={(e) => { e.stopPropagation(); cyclePhase(i); }}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${i.status === "done" ? "bg-moss text-cream" : i.status === "doing" ? "bg-ember text-cream" : "border border-border"}`}
                >
                  {i.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : i.status === "doing" ? <PlayCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                  {i.status}
                </span>
              </button>

              {/* Expanded sub-topics flowchart */}
              {isOpen && (
                <div className="border-t border-border px-4 pb-4 pt-2">
                  {subs.length === 0 ? (
                    <div className="py-4 text-center text-xs text-muted-foreground">No sub-topics available for this phase.</div>
                  ) : (
                    <ol className="relative ml-3 space-y-3 border-l-2 border-dashed border-border pl-6 pt-2">
                      {subs.map((s, si) => (
                        <li key={s.id} className="relative">
                          <span className="absolute -left-[33px] top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-border bg-card text-[10px] font-semibold">
                            {si + 1}
                          </span>
                          <div className={`rounded-xl border p-3 ${s.completed ? "border-moss/40 bg-moss/5" : "border-border bg-background"}`}>
                            <div className="flex items-start gap-3">
                              <button onClick={() => toggleSubtopic(i.id, s)} className="mt-0.5" aria-label="Toggle complete">
                                {s.completed ? <CheckCircle2 className="h-5 w-5 text-moss" /> : <Circle className="h-5 w-5 text-muted-foreground hover:text-ember" />}
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className={`text-sm font-medium ${s.completed ? "line-through opacity-70" : ""}`}>{s.title}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">{s.description}</div>

                                {s.resources.length > 0 && (
                                  <div className="mt-3 space-y-1.5">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Resources</div>
                                    {s.resources
                                      .slice()
                                      .sort((a, b) => {
                                        const order = { beginner: 0, intermediate: 1, advanced: 2 } as const;
                                        return (order[a.difficulty] ?? 3) - (order[b.difficulty] ?? 3);
                                      })
                                      .map((r, ri) => {
                                        const isYt = r.source === "youtube";
                                        const href = isYt ? getYoutubeWatchUrl(r.url) : r.url;
                                        const content = (
                                          <>
                                            {isYt ? (
                                              <Youtube className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                                            ) : (
                                              <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ember" />
                                            )}
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-1 font-medium">
                                                <span className="truncate">{r.title}</span>
                                                <ExternalLink className="h-3 w-3 shrink-0" />
                                              </div>
                                              <div className="mt-0.5 text-muted-foreground">{r.description}</div>
                                              <div className="mt-1 flex flex-wrap gap-1">
                                                <span className="rounded-full bg-muted px-1.5 py-0.5">{r.difficulty}</span>
                                                <span className="rounded-full bg-muted px-1.5 py-0.5">{r.duration}</span>
                                                <span className="rounded-full bg-muted px-1.5 py-0.5">{r.source}</span>
                                              </div>
                                            </div>
                                          </>
                                        );

                                        return isYt ? (
                                          <button
                                            key={ri}
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              if (href) openInNewBrowserTab(href);
                                            }}
                                            className="flex w-full items-start gap-2 rounded-md border border-border bg-card p-2 text-left text-xs hover:border-ember"
                                            aria-label={`Open YouTube video: ${r.title}`}
                                          >
                                            {content}
                                          </button>
                                        ) : (
                                          <a
                                            key={ri}
                                            href={href ?? undefined}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-start gap-2 rounded-md border border-border bg-card p-2 text-xs hover:border-ember"
                                          >
                                            {content}
                                          </a>
                                        );
                                      })}

                                  </div>
                                )}

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    onClick={() => startQuiz(s)}
                                    className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
                                  >
                                    <Sparkles className="h-3 w-3" /> Take quiz
                                  </button>
                                </div>

                                {/* Inline quiz panel */}
                                {quizFor === s.id && (
                                  <div className="mt-3 rounded-lg border border-ember/40 bg-ember/5 p-3">
                                    {!quiz ? (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating quiz for "{s.title}"...
                                      </div>
                                    ) : result ? (
                                      <div>
                                        <div className="display text-3xl text-ember">
                                          {result.score}
                                          <span className="text-sm text-muted-foreground">/100</span>
                                        </div>
                                        {result.weak_concepts.length === 0 ? (
                                          <div className="mt-1 text-xs text-moss">Solid grasp — ready to move on.</div>
                                        ) : (
                                          <ul className="mt-1 space-y-0.5 text-xs">
                                            {result.weak_concepts.map((w) => (
                                              <li key={w.concept}>⚠ <b>{w.concept}</b> — {w.wrong}/{w.total} wrong</li>
                                            ))}
                                          </ul>
                                        )}
                                        <button
                                          onClick={() => { setQuizFor(null); setQuiz(null); setResult(null); }}
                                          className="mt-2 rounded-full border border-border px-3 py-1 text-xs"
                                        >
                                          Close
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        {quiz.questions.map((q, qi) => (
                                          <div key={q.id} className="rounded-md border border-border bg-card p-2">
                                            <div className="text-xs font-medium">{qi + 1}. {q.question}</div>
                                            <div className="mt-2 grid gap-1.5">
                                              {q.options.map((opt) => (
                                                <label
                                                  key={opt}
                                                  className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-xs ${answers[q.id] === opt ? "border-ember bg-ember/10" : "border-border hover:bg-muted"}`}
                                                >
                                                  <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => setAnswers({ ...answers, [q.id]: opt })} />
                                                  {opt}
                                                </label>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                        <button
                                          disabled={Object.keys(answers).length !== quiz.questions.length}
                                          onClick={gradeQuiz}
                                          className="rounded-full bg-ink px-4 py-1.5 text-xs text-cream disabled:opacity-50"
                                        >
                                          Grade quiz
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {raw.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No roadmap yet — enter a career path above to generate one.
          </div>
        )}
        {raw.length > 0 && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No phases match your filter.
          </div>
        )}
      </ol>
    </PageShell>
  );
}
