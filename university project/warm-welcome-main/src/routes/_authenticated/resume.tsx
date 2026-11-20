import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageShell } from "./route";
import { analyzeResume, listResumes } from "@/lib/features.functions";
import { toast } from "sonner";
import { FileText, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/resume")({
  head: () => ({
    meta: [
      { title: "Resume Optimizer · Automated Recommendation System" },
      { name: "description", content: "ATS scoring and recruiter-grade rewrite suggestions." },
      { property: "og:title", content: "Resume Optimizer · Automated Recommendation System" },
      { property: "og:description", content: "Get an ATS score, keyword gaps, and rewritten bullets." },
    ],
  }),
  component: ResumePage,
});

type Analysis = {
  ats_score: number;
  keyword_coverage: { present: string[]; missing: string[] };
  strengths: string[];
  issues: { section: string; issue: string; suggestion: string; severity: string }[];
  rewrite_suggestions: { original: string; improved: string; reason: string }[];
  summary: string;
};

function ResumePage() {
  const analyze = useServerFn(analyzeResume);
  const list = useServerFn(listResumes);
  const qc = useQueryClient();
  const { data: history } = useQuery({ queryKey: ["resumes"], queryFn: () => list() });

  const [content, setContent] = useState("");
  const [role, setRole] = useState("");

  const mut = useMutation({
    mutationFn: () => analyze({ data: { content, targetRole: role } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resumes"] });
      toast.success("Analysis complete");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const latest = (mut.data ?? history?.[0]) as { analysis: Analysis; ats_score: number; target_role: string; is_ats_optimized?: boolean } | undefined;

  return (
    <PageShell title="Resume Optimizer" subtitle="Paste your resume, pick a target role, get scored the way a real recruiter's ATS would.">
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-panel lg:col-span-2">
          <h2 className="text-lg font-semibold">Analyze resume</h2>
          <div className="mt-4 space-y-3">
            <label className="block">
              <div className="mb-1 text-xs font-medium text-muted-foreground">Target role</div>
              <input value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ember" placeholder="Software Engineer Intern"/>
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-medium text-muted-foreground">Resume text</div>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14} placeholder="Paste your resume as plain text..." className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ember"/>
            </label>
            <button disabled={!role || content.length < 50 || mut.isPending} onClick={() => mut.mutate()} className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm text-cream disabled:opacity-50">
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileText className="h-4 w-4"/>} Score it
            </button>
          </div>
        </div>

        <div className="lg:col-span-3">
          {latest ? (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-panel">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">ATS Score</div>
                  <div className="display text-6xl text-ember">{latest.ats_score}</div>
                  <AtsBadge score={latest.ats_score} optimized={latest.is_ats_optimized} />
                </div>
                <div className="text-right text-sm text-muted-foreground">for <span className="font-medium text-foreground">{latest.target_role}</span></div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{latest.analysis.summary}</p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Keywords present</h3>
                  <div className="flex flex-wrap gap-1">
                    {latest.analysis.keyword_coverage.present.map((k) => (
                      <span key={k} className="rounded-full bg-moss/15 px-2 py-0.5 text-xs text-moss">{k}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Missing keywords</h3>
                  <div className="flex flex-wrap gap-1">
                    {latest.analysis.keyword_coverage.missing.map((k) => (
                      <span key={k} className="rounded-full bg-ember/10 px-2 py-0.5 text-xs text-ember">{k}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Issues</h3>
                <div className="space-y-2">
                  {latest.analysis.issues.map((i, idx) => (
                    <div key={idx} className="rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className={`h-4 w-4 ${i.severity === "high" ? "text-destructive" : "text-ember"}`}/>
                        <span className="font-medium">{i.section}</span>
                        <span className="text-xs text-muted-foreground">· {i.severity}</span>
                      </div>
                      <div className="mt-1 text-sm">{i.issue}</div>
                      <div className="mt-1 text-xs text-muted-foreground">→ {i.suggestion}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Rewrite suggestions</h3>
                <div className="space-y-3">
                  {latest.analysis.rewrite_suggestions.map((r, idx) => (
                    <div key={idx} className="rounded-lg border border-border p-3 text-sm">
                      <div className="text-muted-foreground line-through">{r.original}</div>
                      <div className="mt-1 flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-moss"/><span>{r.improved}</span></div>
                      <div className="mt-1 text-xs text-muted-foreground">{r.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Your ATS analysis will appear here.
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function AtsBadge({ score, optimized }: { score: number; optimized?: boolean }) {
  const isOptimized = optimized ?? score >= 80;
  return (
    <div
      className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        isOptimized
          ? "border-moss/40 bg-moss/10 text-moss"
          : "border-ember/40 bg-ember/10 text-ember"
      }`}
    >
      {isOptimized ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
      {isOptimized ? "ATS Optimized" : "Needs ATS Optimization"}
    </div>
  );
}
