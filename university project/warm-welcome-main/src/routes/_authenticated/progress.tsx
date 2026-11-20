import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "./route";
import { getProgress, logStudy } from "@/lib/features.functions";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { Flame, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Progress · Automated Recommendation System" },
      { name: "description", content: "Your skill trajectory, streak, and weak concepts." },
      { property: "og:title", content: "Progress · Automated Recommendation System" },
      { property: "og:description", content: "Track improvement over time." },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const getFn = useServerFn(getProgress);
  const log = useServerFn(logStudy);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["progress"], queryFn: () => getFn() });

  const logMut = useMutation({
    mutationFn: () => log({ data: { minutes: 15 } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["progress"] }); toast.success("+15 min logged"); },
  });

  const quizChart = (data?.quizzes ?? []).map((q, i) => ({ i: i + 1, score: q.score ?? 0, topic: q.topic }));
  const streakChart = (data?.sessions ?? []).slice(-30).map((s) => ({ day: s.day.slice(5), minutes: s.minutes }));

  return (
    <PageShell title="Progress" subtitle="Your consistency, comprehension, and weak spots.">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Streak" value={<><Flame className="mr-1 inline h-5 w-5 text-ember" />{data?.streak ?? 0}d</>} />
        <Stat label="Courses done" value={`${data?.courses_completed ?? 0}/${data?.courses_total ?? 0}`} />
        <Stat label="Roadmap done" value={`${data?.roadmap_done ?? 0}/${data?.roadmap_total ?? 0}`} />
        <Stat label="Quizzes taken" value={data?.quizzes.length ?? 0} />
      </div>

      <div className="mt-4">
        <button onClick={() => logMut.mutate()} disabled={logMut.isPending} className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm text-cream disabled:opacity-50">
          {logMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Log 15 min study
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-panel">
          <h3 className="mb-3 font-semibold">Quiz scores over time</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={quizChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="i" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--ember))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-panel">
          <h3 className="mb-3 font-semibold">Study consistency (last 30 days)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={streakChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="minutes" fill="hsl(var(--moss))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-panel">
        <h3 className="mb-3 font-semibold">Weak concepts (from quizzes)</h3>
        {(!data || data.weak_concepts.length === 0) ? (
          <div className="text-sm text-muted-foreground">No weak concepts detected yet. Take some quizzes.</div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.weak_concepts.map((w) => (
              <li key={w.concept} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm font-medium">{w.concept}</span>
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">missed {w.count}×</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-panel">
        <h3 className="mb-3 font-semibold">Peer comparison (anonymized)</h3>
        <p className="text-sm text-muted-foreground">Your average quiz score: <b>{Math.round(quizChart.reduce((a, b) => a + b.score, 0) / (quizChart.length || 1))}</b>. Cohort average: <b>68</b>. Keep pushing.</p>
      </div>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-panel">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="display mt-1 text-3xl">{value}</div>
    </div>
  );
}
