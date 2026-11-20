import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn as useSFn } from "@tanstack/react-start";
import { PageShell } from "./route";
import { getMyProfile, listSkillAssessments, listResumes, listInterviews, getMyPortfolio, updateMyProfile } from "@/lib/features.functions";
import { Brain, FileText, Mic, Github, Sparkles, ArrowRight, Trophy, Flame } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Automated Recommendation System" },
      { name: "description", content: "Your career progress at a glance." },
      { property: "og:title", content: "Dashboard · Automated Recommendation System" },
      { property: "og:description", content: "Track your skill gaps, resumes, interviews, and portfolio." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const getProfile = useSFn(getMyProfile);
  const listSkills = useSFn(listSkillAssessments);
  const listRes = useSFn(listResumes);
  const listInt = useSFn(listInterviews);
  const getPort = useSFn(getMyPortfolio);
  const updateProfile = useSFn(updateMyProfile);

  const { data: profile, refetch } = useQuery({ queryKey: ["profile.me"], queryFn: () => getProfile() });
  const { data: skills } = useQuery({ queryKey: ["skills"], queryFn: () => listSkills() });
  const { data: resumes } = useQuery({ queryKey: ["resumes"], queryFn: () => listRes() });
  const { data: interviews } = useQuery({ queryKey: ["interviews"], queryFn: () => listInt() });
  const { data: portfolio } = useQuery({ queryKey: ["portfolio"], queryFn: () => getPort() });

  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const saveRole = async () => {
    setSaving(true);
    try {
      await updateProfile({ data: { target_role: role } });
      toast.success("Target role updated");
      refetch();
      setRole("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const bestSkill = skills?.[0]?.overall_score ?? null;
  const bestResume = resumes?.[0]?.ats_score ?? null;
  const bestInterview = interviews?.find((i) => i.overall_score)?.overall_score ?? null;
  const streak = [skills?.length, resumes?.length, interviews?.length, portfolio ? 1 : 0].filter(Boolean).length;

  return (
    <PageShell title={`Hey${profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}.`} subtitle="Here's your career command center.">
      {!profile?.target_role && (
        <div className="mb-6 rounded-2xl border border-ember/30 bg-ember/5 p-5">
          <h3 className="font-semibold">What role are you targeting?</h3>
          <p className="mt-1 text-sm text-muted-foreground">Setting a target role personalizes every feature.</p>
          <div className="mt-3 flex gap-2">
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Junior Frontend Engineer"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ember"
            />
            <button
              onClick={saveRole}
              disabled={!role || saving}
              className="rounded-lg bg-ink px-4 py-2 text-sm text-cream disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={Trophy} label="Skill Score" value={bestSkill != null ? `${bestSkill}` : "—"} sub="latest assessment" />
        <Stat icon={FileText} label="ATS Score" value={bestResume != null ? `${bestResume}` : "—"} sub="best resume" />
        <Stat icon={Mic} label="Interview" value={bestInterview != null ? `${bestInterview}` : "—"} sub="mock rating" />
        <Stat icon={Flame} label="Features used" value={`${streak}/4`} sub="ecosystem streak" />
      </div>

      <h2 className="mt-10 mb-4 display text-2xl">Jump back in</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <FeatureCard to="/skills" icon={Brain} title="Skill Gap Analysis" desc="Find what to learn next for your target role." />
        <FeatureCard to="/resume" icon={FileText} title="Resume Optimizer" desc="Score your resume against ATS + recruiter patterns." />
        <FeatureCard to="/interview" icon={Mic} title="Mock Interviewer" desc="Practice with a live AI interviewer and get evaluated." />
        <FeatureCard to="/portfolio" icon={Github} title="Portfolio Builder" desc="Turn your GitHub into a polished project showcase." />
        <FeatureCard to="/agent" icon={Sparkles} title="Chat with Automated Recommendation System" desc="Your always-on AI career mentor." accent />
      </div>
    </PageShell>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-panel">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-ember" />
      </div>
      <div className="mt-3 display text-4xl">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function FeatureCard({ to, icon: Icon, title, desc, accent }: { to: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string; accent?: boolean }) {
  return (
    <Link
      to={to}
      className={`group flex items-center justify-between rounded-2xl border p-5 shadow-panel transition hover:-translate-y-0.5 ${
        accent ? "border-ember/40 bg-ember/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`grid h-10 w-10 place-items-center rounded-full ${accent ? "bg-ember text-cream" : "bg-muted text-ink"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </Link>
  );
}
