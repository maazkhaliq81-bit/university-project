import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageShell } from "./route";
import { runSkillGap, listSkillAssessments } from "@/lib/features.functions";
import { toast } from "sonner";
import { Brain, Loader2, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/skills")({
  head: () => ({
    meta: [
      { title: "Skill Gap Analysis · Automated Recommendation System" },
      { name: "description", content: "AI-powered skill gap analysis for your target role." },
      { property: "og:title", content: "Skill Gap Analysis · Automated Recommendation System" },
      { property: "og:description", content: "Predict which concepts you'll struggle with — and get a learning path." },
    ],
  }),
  component: SkillsPage,
});

type Analysis = {
  overall_score: number;
  summary: string;
  strengths: { name: string; note: string }[];
  gaps: { name: string; priority: string; predicted_struggle: string; why: string }[];
  learning_path: { step: number; topic: string; resources: string[]; estimated_weeks: number }[];
  market_signal: { demand: string; salary_range_usd: string; trend: string };
};

function SkillsPage() {
  const run = useServerFn(runSkillGap);
  const list = useServerFn(listSkillAssessments);
  const qc = useQueryClient();
  const { data: history } = useQuery({ queryKey: ["skills"], queryFn: () => list() });

  const [role, setRole] = useState("");
  const [current, setCurrent] = useState("");
  const [experience, setExperience] = useState("");

  const mut = useMutation({
    mutationFn: () => run({ data: { targetRole: role, currentSkills: current, experience } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      toast.success("Analysis ready");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const latest = (mut.data ?? history?.[0]) as { analysis: Analysis; target_role: string; overall_score: number } | undefined;

  return (
    <PageShell title="Skill Gap Analysis" subtitle="Tell Automated Recommendation System what you know and what you want to be — get a predicted-struggle map and learning path.">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-panel">
          <h2 className="text-lg font-semibold">Run an assessment</h2>
          <div className="mt-4 space-y-3">
            <Field label="Target role">
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Junior ML Engineer" className={inputCls} />
            </Field>
            <Field label="Current skills (comma or free-form)">
              <textarea value={current} onChange={(e) => setCurrent(e.target.value)} rows={4} placeholder="Python, some pandas, built a CRUD Flask app, took Andrew Ng's course..." className={inputCls} />
            </Field>
            <Field label="Experience (optional)">
              <textarea value={experience} onChange={(e) => setExperience(e.target.value)} rows={3} placeholder="2nd-year CS student, one internship at..." className={inputCls} />
            </Field>
            <button
              disabled={!role || !current || mut.isPending}
              onClick={() => mut.mutate()}
              className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm text-cream disabled:opacity-50"
            >
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Analyze
            </button>
          </div>
        </div>

        <div>
          {latest ? (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-panel">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">{latest.target_role}</h2>
                <div className="display text-4xl text-ember">{latest.overall_score}</div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{latest.analysis.summary}</p>

              <Section title="Predicted struggle points">
                <div className="space-y-2">
                  {latest.analysis.gaps.map((g) => (
                    <div key={g.name} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{g.name}</div>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${g.priority === "high" ? "bg-destructive/10 text-destructive" : g.priority === "medium" ? "bg-ember/15 text-ember" : "bg-muted text-muted-foreground"}`}>{g.priority}</span>
                      </div>
                      <div className="mt-1 text-sm">⚠ {g.predicted_struggle}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{g.why}</div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Strengths">
                <ul className="space-y-1 text-sm">
                  {latest.analysis.strengths.map((s) => (
                    <li key={s.name}><span className="font-medium">{s.name}</span> — <span className="text-muted-foreground">{s.note}</span></li>
                  ))}
                </ul>
              </Section>

              <Section title="Learning path">
                <ol className="space-y-2">
                  {latest.analysis.learning_path.map((step) => (
                    <li key={step.step} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{step.step}. {step.topic}</div>
                        <div className="text-xs text-muted-foreground">~{step.estimated_weeks}w</div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{step.resources.join(" · ")}</div>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section title="Market signal">
                <div className="flex items-center gap-3 text-sm">
                  <TrendingUp className="h-4 w-4 text-moss" />
                  <span className="font-medium capitalize">{latest.analysis.market_signal.demand} demand</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{latest.analysis.market_signal.salary_range_usd}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{latest.analysis.market_signal.trend}</p>
              </Section>
            </div>
          ) : (
            <div className="grid h-full place-items-center rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Your analysis will appear here.
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ember";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}
