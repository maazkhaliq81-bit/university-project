import { createFileRoute, redirect, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Brain, FileText, Mic, Github, Sparkles, LayoutDashboard, LogOut, User, ClipboardList, PlayCircle, Map, IdCard, Briefcase, LineChart } from "lucide-react";
import type { ReactNode } from "react";
import logoMark from "@/assets/logo-mark.png";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const demoSession = localStorage.getItem("demo_user_session");
      if (demoSession) {
        try {
          const parsed = JSON.parse(demoSession);
          return { user: parsed };
        } catch {}
      }
    }
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) throw redirect({ to: "/auth" });
      return { user: data.user };
    } catch (err) {
      if ((err as Record<string, unknown>)?.to === "/auth") throw err;
      const demoUser = {
        id: "demo-user-123",
        email: "demo@example.com",
        user_metadata: { full_name: "Demo Student" },
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("demo_user_session", JSON.stringify(demoUser));
      }
      return { user: demoUser };
    }
  },
  component: AuthedLayout,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assessment", label: "Assessment", icon: ClipboardList },
  { to: "/courses", label: "Courses", icon: PlayCircle },
  { to: "/roadmap", label: "Roadmap", icon: Map },
  { to: "/skills", label: "Skill Gap", icon: Brain },
  { to: "/cv", label: "CV Builder", icon: IdCard },
  { to: "/resume", label: "Resume", icon: FileText },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/interview", label: "Interview", icon: Mic },
  { to: "/portfolio", label: "Portfolio", icon: Github },
  { to: "/progress", label: "Progress", icon: LineChart },
  { to: "/agent", label: "Automated Recommendation System Agent", icon: Sparkles },
] as const;

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      try {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
        return data;
      } catch {
        return null;
      }
    },
  });

  const signOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("demo_user_session");
    }
    await qc.cancelQueries();
    qc.clear();
    try {
      await supabase.auth.signOut();
    } catch {}
    navigate({ to: "/auth", replace: true });
  };

  const isAgent = location.pathname.startsWith("/agent");

  if (isAgent) {
    return <Outlet />;
  }

  return (
    <div className="grain-bg flex min-h-screen">
      <aside className="hidden w-64 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <img src={logoMark} alt="Automated Recommendation System" className="h-9 w-9 object-contain" />
          <span className="display text-xl">Automated Recommendation System</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-ink text-cream"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <item.icon className="h-4 w-4" strokeWidth={1.6} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-muted">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {profile?.display_name ?? user.email}
              </div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <MobileNav />
        <Outlet />
      </main>
    </div>
  );
}



function MobileNav() {
  const location = useLocation();
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/80 px-3 py-2 backdrop-blur md:hidden">
      <div className="flex flex-1 overflow-x-auto">
        {nav.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${
                active ? "bg-ink text-cream" : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" /> {item.label}
            </Link>
          );
        })}
      </div>
      <ThemeToggle />
    </div>
  );
}

export function PageShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display text-3xl md:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
        </div>
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
