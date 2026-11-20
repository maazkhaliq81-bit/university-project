import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, ChevronDown, Loader2, Radio } from "lucide-react";

type AgentLog = {
  id: string;
  level: string;
  message: string;
  created_at: string;
};

const AGENT_WEBHOOK_URL = "http://localhost:5000/api/agent/start";

export function AgentAutomationBar() {
  const [userId, setUserId] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);

  // load profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) { setLoading(false); return; }
      if (cancelled) return;
      setUserId(uid);
      const { data } = await supabase
        .from("profiles")
        .select("is_agent_active")
        .eq("id", uid)
        .maybeSingle();
      if (cancelled) return;
      setActive(Boolean((data as { is_agent_active?: boolean } | null)?.is_agent_active));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // load initial logs + subscribe realtime
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("agent_logs" as never)
        .select("id, level, message, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!mounted) return;
      setLogs(((data as AgentLog[] | null) ?? []).reverse());
    })();

    const channel = supabase
      .channel(`agent_logs:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_logs", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as AgentLog;
          setLogs((prev) => [...prev.slice(-99), row]);
        }
      )
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [userId]);

  async function toggle() {
    if (!userId || saving) return;
    const next = !active;
    setSaving(true);
    setActive(next);
    const { error } = await supabase
      .from("profiles")
      .update({ is_agent_active: next } as never)
      .eq("id", userId);
    if (error) {
      setActive(!next);
      toast.error("Could not update agent status");
      setSaving(false);
      return;
    }
    if (next) {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const res = await fetch(AGENT_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ user_id: userId }),
        });
        if (!res.ok) throw new Error(`Agent start failed (${res.status})`);
        toast.success("Agent activated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not reach agent service");
      }
    } else {
      toast.success("Agent paused");
    }
    setSaving(false);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6">
      <div className="glass-strong rounded-2xl border border-border/60 shadow-panel">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`brand-gradient grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm ${active ? "" : "opacity-60"}`}>
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Agent Automation Status</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {loading ? "Loading…" : active ? "Autonomous mode is running for your account" : "Agent is paused — toggle to run in the background"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFeedOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground/80 transition hover:border-[#6366F1]/40 hover:text-foreground"
            >
              <Radio className={`h-3.5 w-3.5 ${active ? "text-emerald-500" : "text-muted-foreground"}`} />
              Activity
              <ChevronDown className={`h-3 w-3 transition ${feedOpen ? "rotate-180" : ""}`} />
            </button>
            <button
              disabled={loading || saving || !userId}
              onClick={toggle}
              aria-pressed={active}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${active ? "bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] shadow-cta" : "bg-muted"}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${active ? "translate-x-6" : "translate-x-1"}`}
              />
              {saving && (
                <Loader2 className="pointer-events-none absolute inset-0 m-auto h-3 w-3 animate-spin text-white/90" />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {feedOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border/60"
            >
              <div className="px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Agent Activity Feed
                  </div>
                  <div className="text-[10px] text-muted-foreground">Realtime · agent_logs</div>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-xl bg-black/85 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
                  {logs.length === 0 ? (
                    <div className="text-emerald-500/60">
                      {active ? "Waiting for agent output…" : "No activity yet. Activate the agent to begin."}
                    </div>
                  ) : (
                    logs.map((l) => (
                      <div key={l.id} className="whitespace-pre-wrap">
                        <span className="text-emerald-500/60">
                          [{new Date(l.created_at).toLocaleTimeString()}]
                        </span>{" "}
                        <span className={
                          l.level === "error" ? "text-red-400" :
                          l.level === "warn" ? "text-amber-300" :
                          "text-emerald-300"
                        }>
                          {l.level.toUpperCase()}
                        </span>{" "}
                        {l.message}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default AgentAutomationBar;