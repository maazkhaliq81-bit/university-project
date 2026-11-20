import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, FileText, Mic, Github, Sparkles, ArrowRight } from "lucide-react";
import logoMark from "@/assets/logo-mark.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Automated Recommendation System — AI Career Ecosystem for Students" },
      {
        name: "description",
        content:
          "Skill gap analysis, ATS resume scoring, mock interviews, portfolio building, and your own AI career agent. Built for students.",
      },
      { property: "og:title", content: "Automated Recommendation System — AI Career Ecosystem for Students" },
      {
        property: "og:description",
        content: "All the tools you need to land your first role — powered by AI.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [authed, setAuthed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const features = [
    { icon: Brain, title: "Skill Gap Analysis", desc: "AI predicts which concepts you'll struggle with — before you hit them." },
    { icon: FileText, title: "Resume Optimizer", desc: "ATS scoring with recruiter-grade rewrite suggestions." },
    { icon: Mic, title: "Mock Interviewer", desc: "Live conversational interviews with AI evaluation across four dimensions." },
    { icon: Github, title: "Portfolio Builder", desc: "Pulls your GitHub and turns repos into a portfolio you can show off." },
    { icon: Sparkles, title: "Automated Recommendation System — your career agent", desc: "A Gemini-style AI mentor that knows your profile and goals." },
  ];

  return (
    <div className="min-h-screen grain-bg">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoMark} alt="Automated Recommendation System" className="h-9 w-9 object-contain" />
          <span className="display text-xl">Automated Recommendation System</span>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <ThemeToggle />
          {authed ? (
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="rounded-full bg-ink px-4 py-2 text-cream hover:opacity-90"
            >
              Open dashboard
            </button>
          ) : (
            <>
              <Link to="/auth" className="rounded-full px-4 py-2 hover:bg-muted">
                Sign in
              </Link>
              <Link
                to="/auth"
                className="rounded-full bg-ink px-4 py-2 text-cream hover:opacity-90"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-ember" />
            An AI career ecosystem, not another job board
          </div>
          <h1 className="display text-6xl leading-[0.95] md:text-8xl">
            Land your first role,
            <br />
            <em className="text-ember">without the guesswork.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Automated Recommendation System is a personal AI career agent for students. Analyze your skill gaps, score your
            resume against real ATS patterns, practice interviews out loud, and turn your GitHub
            into a portfolio — all in one flow.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to={authed ? "/dashboard" : "/auth"}
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-cream shadow-cta transition hover:opacity-90"
            >
              {authed ? "Open your dashboard" : "Start free"}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a href="#features" className="rounded-full border border-border px-6 py-3 text-sm hover:bg-muted">
              See what's inside
            </a>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-10 flex items-end justify-between">
          <h2 className="display text-4xl">Everything career, in one place.</h2>
          <span className="hidden text-xs uppercase tracking-widest text-muted-foreground md:block">
            v1 · student edition
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-6 shadow-panel transition hover:-translate-y-0.5 hover:border-ember/40"
            >
              <f.icon className="h-6 w-6 text-ember" strokeWidth={1.6} />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Automated Recommendation System · Built for students who move fast.
      </footer>
    </div>
  );
}
