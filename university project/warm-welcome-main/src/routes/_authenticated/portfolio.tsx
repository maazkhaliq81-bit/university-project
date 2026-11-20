import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageShell } from "./route";
import { buildPortfolio, getMyPortfolio } from "@/lib/features.functions";
import { toast } from "sonner";
import { Github, Loader2, Star, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio Builder · Automated Recommendation System" },
      { name: "description", content: "Turn your GitHub into a polished portfolio in seconds." },
      { property: "og:title", content: "Portfolio Builder · Automated Recommendation System" },
      { property: "og:description", content: "AI-generated descriptions for your repos." },
    ],
  }),
  component: PortfolioPage,
});

type Portfolio = {
  github_username: string;
  bio: string | null;
  projects: { name: string; url: string; language: string; stars: number; description: string; tech: string[] }[];
};

function PortfolioPage() {
  const build = useServerFn(buildPortfolio);
  const get = useServerFn(getMyPortfolio);
  const qc = useQueryClient();
  const { data: existing } = useQuery({ queryKey: ["portfolio"], queryFn: () => get() });

  const [username, setUsername] = useState("");
  const mut = useMutation({
    mutationFn: () => build({ data: { githubUsername: username } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success("Portfolio built");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const portfolio = (mut.data ?? existing) as Portfolio | undefined;

  return (
    <PageShell title="Portfolio Builder" subtitle="Point Automated Recommendation System at your GitHub username — get a polished, recruiter-ready showcase.">
      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-4 shadow-panel">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3">
          <Github className="h-4 w-4 text-muted-foreground"/>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="github username" className="flex-1 bg-transparent py-2 text-sm outline-none"/>
        </div>
        <button onClick={() => mut.mutate()} disabled={!username || mut.isPending} className="flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm text-cream disabled:opacity-50">
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Github className="h-4 w-4"/>} Build portfolio
        </button>
      </div>

      {portfolio ? (
        <div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-panel">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">@{portfolio.github_username}</div>
            <p className="mt-2 text-lg">{portfolio.bio}</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {portfolio.projects.map((p) => (
              <a key={p.name} href={p.url} target="_blank" rel="noreferrer" className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-panel transition hover:-translate-y-0.5 hover:border-ember/40">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold group-hover:text-ember">{p.name}</h3>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground"/>
                </div>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {p.language && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{p.language}</span>}
                  {p.tech.slice(0, 4).map((t) => <span key={t} className="rounded-full bg-ember/10 px-2 py-0.5 text-xs text-ember">{t}</span>)}
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3 w-3"/> {p.stars}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
          Enter your GitHub username above to generate a portfolio.
        </div>
      )}
    </PageShell>
  );
}
