import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageShell } from "./route";
import { searchCourses, listCourses, toggleCourseComplete, generateQuiz, submitQuiz } from "@/lib/features.functions";
import { toast } from "sonner";
import { PlayCircle, Loader2, CheckCircle2, Circle, ExternalLink, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/courses")({
  head: () => ({
    meta: [
      { title: "Courses · Automated Recommendation System" },
      { name: "description", content: "Curated YouTube videos and free courses ranked by relevance." },
      { property: "og:title", content: "Courses · Automated Recommendation System" },
      { property: "og:description", content: "Learn by topic. Then take an AI quiz to lock it in." },
    ],
  }),
  component: CoursesPage,
});

type Course = { id: string; topic: string; title: string; url: string; source: string; difficulty: string | null; relevance: number | null; reason: string | null; completed: boolean };
type QuizQ = { id: string; question: string; options: string[]; correct: string; concept: string; explanation: string };

function CoursesPage() {
  const search = useServerFn(searchCourses);
  const list = useServerFn(listCourses);
  const toggle = useServerFn(toggleCourseComplete);
  const genQuiz = useServerFn(generateQuiz);
  const subQuiz = useServerFn(submitQuiz);
  const qc = useQueryClient();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("beginner");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<{ id: string; questions: QuizQ[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; weak_concepts: { concept: string; wrong: number; total: number }[] } | null>(null);

  const { data: courses } = useQuery({ queryKey: ["courses"], queryFn: () => list() });
  const grouped = useMemo(() => {
    const map = new Map<string, Course[]>();
    for (const c of (courses ?? []) as Course[]) {
      const arr = map.get(c.topic) ?? [];
      arr.push(c);
      map.set(c.topic, arr);
    }
    return Array.from(map.entries());
  }, [courses]);

  const searchMut = useMutation({
    mutationFn: () => search({ data: { topic, level } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["courses"] }); setActiveTopic(topic); toast.success("Curated!"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const quizGen = useMutation({
    mutationFn: (t: string) => genQuiz({ data: { topic: t } }),
    onSuccess: (q) => { setQuiz({ id: q.id, questions: q.questions as QuizQ[] }); setAnswers({}); setResult(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const quizSub = useMutation({
    mutationFn: () => subQuiz({ data: { quizId: quiz!.id, answers: Object.entries(answers).map(([id, choice]) => ({ id, choice })) } }),
    onSuccess: (r) => setResult({ score: r.score ?? 0, weak_concepts: (r.weak_concepts as { concept: string; wrong: number; total: number }[]) ?? [] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <PageShell title="Courses" subtitle="Search a topic — get a ranked list of the best videos. Then test yourself.">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-panel">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Topic</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="React hooks, SQL joins, gradient descent..." className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ember" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Level</span>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option>beginner</option><option>intermediate</option><option>advanced</option>
            </select>
          </label>
          <button disabled={!topic || searchMut.isPending} onClick={() => searchMut.mutate()} className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm text-cream disabled:opacity-50">
            {searchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Find courses
          </button>
        </div>
      </div>

      {quiz && (
        <div className="mt-6 rounded-2xl border border-ember/40 bg-card p-6 shadow-panel">
          <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-ember" /> Quiz: {activeTopic}</div>
          {result ? (
            <div className="mt-4">
              <div className="display text-5xl text-ember">{result.score}<span className="text-xl text-muted-foreground">/100</span></div>
              <div className="mt-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Weak concepts</div>
                {result.weak_concepts.length === 0 ? (
                  <div className="mt-1 text-sm text-moss">No weaknesses detected — solid grasp.</div>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {result.weak_concepts.map((w) => <li key={w.concept}>⚠ <b>{w.concept}</b> — {w.wrong}/{w.total} wrong</li>)}
                  </ul>
                )}
              </div>
              <button onClick={() => { setQuiz(null); setResult(null); }} className="mt-4 rounded-full border border-border px-4 py-2 text-sm">Close</button>
            </div>
          ) : (
            <ol className="mt-4 space-y-4">
              {quiz.questions.map((q, i) => (
                <li key={q.id} className="rounded-lg border border-border p-4">
                  <div className="text-sm font-medium">{i + 1}. {q.question}</div>
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
              <button disabled={Object.keys(answers).length !== quiz.questions.length || quizSub.isPending} onClick={() => quizSub.mutate()} className="mt-3 flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm text-cream disabled:opacity-50">
                {quizSub.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Grade quiz
              </button>
            </ol>
          )}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {grouped.length === 0 && <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No courses yet — search a topic above.</div>}
        {grouped.map(([t, items]) => (
          <div key={t} className="rounded-2xl border border-border bg-card p-6 shadow-panel">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t}</h3>
              <button onClick={() => { setActiveTopic(t); quizGen.mutate(t); }} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50" disabled={quizGen.isPending}>
                {quizGen.isPending && activeTopic === t ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Take quiz
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {items.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0)).map((c) => (
                <li key={c.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <button onClick={() => { toggle({ data: { id: c.id, completed: !c.completed } }); qc.invalidateQueries({ queryKey: ["courses"] }); }} className="mt-0.5">
                    {c.completed ? <CheckCircle2 className="h-5 w-5 text-moss" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <a href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium hover:text-ember">
                      {c.title} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <div className="mt-0.5 text-xs text-muted-foreground">{c.reason}</div>
                    <div className="mt-1 flex gap-2 text-xs">
                      <span className="rounded-full bg-muted px-2 py-0.5">{c.difficulty}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5">{c.source}</span>
                      <span className="rounded-full bg-ember/10 px-2 py-0.5 text-ember">rank {c.relevance}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
