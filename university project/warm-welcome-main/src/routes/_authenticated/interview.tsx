import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import { PageShell } from "./route";
import { startInterview, nextInterviewTurn, finishInterview, listInterviews } from "@/lib/features.functions";
import { toast } from "sonner";
import { Mic, Send, Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/interview")({
  head: () => ({
    meta: [
      { title: "Mock Interview · Automated Recommendation System" },
      { name: "description", content: "Live AI mock interviews with a full evaluation report." },
      { property: "og:title", content: "Mock Interview · Automated Recommendation System" },
      { property: "og:description", content: "Practice technical or behavioral interviews and get AI feedback." },
    ],
  }),
  component: InterviewPage,
});

type Session = {
  id: string;
  role: string;
  interview_type: string;
  status: string;
  transcript: { role: string; content: string }[];
  evaluation: Evaluation | null;
  overall_score: number | null;
};
type Evaluation = {
  overall_score: number;
  technical: { score: number; notes: string };
  problem_solving: { score: number; notes: string };
  communication: { score: number; notes: string };
  behavioral: { score: number; notes: string };
  strengths: string[];
  improvements: string[];
  hire_recommendation: string;
};

function InterviewPage() {
  const start = useServerFn(startInterview);
  const next = useServerFn(nextInterviewTurn);
  const finish = useServerFn(finishInterview);
  const list = useServerFn(listInterviews);
  const qc = useQueryClient();
  const { data: history } = useQuery({ queryKey: ["interviews"], queryFn: () => list() });

  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState("");
  const [type, setType] = useState<"technical" | "behavioral" | "mixed">("technical");
  const [answer, setAnswer] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" });
  }, [session?.transcript.length]);

  const startMut = useMutation({
    mutationFn: () => start({ data: { role, type } }),
    onSuccess: (s) => setSession(s as unknown as Session),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const turnMut = useMutation({
    mutationFn: () => next({ data: { sessionId: session!.id, answer } }),
    onSuccess: (s) => {
      setSession(s as unknown as Session);
      setAnswer("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const finishMut = useMutation({
    mutationFn: () => finish({ data: { sessionId: session!.id } }),
    onSuccess: (s) => {
      setSession(s as unknown as Session);
      qc.invalidateQueries({ queryKey: ["interviews"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!session) {
    return (
      <PageShell title="Mock Interview" subtitle="Pick a role and interview style — Automated Recommendation System will conduct a real interview and grade you.">
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 shadow-panel">
          <label className="block">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Role</div>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Frontend Engineer" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ember"/>
          </label>
          <div className="mt-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Type</div>
            <div className="flex gap-2">
              {(["technical", "behavioral", "mixed"] as const).map((t) => (
                <button key={t} onClick={() => setType(t)} className={`rounded-full px-4 py-1.5 text-sm capitalize ${type === t ? "bg-ink text-cream" : "border border-border"}`}>{t}</button>
              ))}
            </div>
          </div>
          <button onClick={() => startMut.mutate()} disabled={!role || startMut.isPending} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-ember px-4 py-2.5 text-sm text-cream disabled:opacity-50">
            {startMut.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Mic className="h-4 w-4"/>} Start interview
          </button>

          {history && history.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Past sessions</h3>
              <ul className="space-y-1 text-sm">
                {history.slice(0, 5).map((h) => (
                  <li key={h.id} className="flex justify-between rounded-lg border border-border px-3 py-2">
                    <span>{h.role} · {h.interview_type}</span>
                    <span className="text-muted-foreground">{h.overall_score ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={`Interview: ${session.role}`} subtitle={`${session.interview_type} · session in progress`}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-4 shadow-panel">
          <div ref={scrollRef} className="max-h-[60vh] space-y-3 overflow-y-auto p-2">
            {session.transcript.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "bg-ink text-cream" : "bg-muted"}`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          {session.status !== "complete" ? (
            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={2}
                placeholder="Type your answer..."
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ember"
              />
              <div className="flex flex-col gap-2">
                <button
                  disabled={!answer || turnMut.isPending}
                  onClick={() => turnMut.mutate()}
                  className="rounded-full bg-ink p-2.5 text-cream disabled:opacity-50"
                >
                  {turnMut.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
                </button>
                <button
                  onClick={() => finishMut.mutate()}
                  disabled={finishMut.isPending}
                  className="rounded-full border border-border px-3 py-1.5 text-xs"
                >
                  End & grade
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-moss/10 p-3 text-sm text-moss">
              <CheckCircle2 className="mr-1 inline h-4 w-4"/> Evaluation complete
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-panel">
          {session.evaluation ? (
            <>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Overall</div>
              <div className="display text-5xl text-ember">{session.evaluation.overall_score}</div>
              <div className="mt-1 text-xs uppercase text-muted-foreground">recommendation: <span className="text-foreground">{session.evaluation.hire_recommendation.replace("_", " ")}</span></div>
              <div className="mt-5 space-y-3">
                {(["technical", "problem_solving", "communication", "behavioral"] as const).map((k) => (
                  <div key={k}>
                    <div className="flex justify-between text-sm"><span className="capitalize">{k.replace("_", " ")}</span><span className="font-mono">{session.evaluation![k].score}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-ember" style={{ width: `${session.evaluation![k].score}%` }}/>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{session.evaluation![k].notes}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Strengths</div>
                <ul className="mt-1 space-y-0.5 text-sm">{session.evaluation.strengths.map((s, i) => <li key={i}>• {s}</li>)}</ul>
              </div>
              <div className="mt-4">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">To improve</div>
                <ul className="mt-1 space-y-0.5 text-sm">{session.evaluation.improvements.map((s, i) => <li key={i}>• {s}</li>)}</ul>
              </div>
              <button onClick={() => setSession(null)} className="mt-6 w-full rounded-full border border-border py-2 text-sm">New interview</button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Answer honestly and out loud if you can. End the interview whenever you're ready for an evaluation.
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
