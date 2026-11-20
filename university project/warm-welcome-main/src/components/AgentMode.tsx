import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { agentTranscribe, agentConverse, agentSpeak } from "@/lib/agent.functions";
import { Mic, Square, Loader2, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Turn = { role: "user" | "assistant"; content: string };

export function AgentModeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-ember px-5 py-2.5 text-sm font-medium text-cream shadow-panel transition hover:opacity-90"
      >
        <Sparkles className="h-4 w-4" />
        Start Agent Mode
      </button>
      {open && <AgentModal onClose={() => setOpen(false)} />}
    </>
  );
}

function AgentModal({ onClose }: { onClose: () => void }) {
  const transcribe = useServerFn(agentTranscribe);
  const converse = useServerFn(agentConverse);
  const speak = useServerFn(agentSpeak);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<"idle" | "recording" | "thinking" | "speaking">("idle");
  const [recommendation, setRecommendation] = useState<{ field: string; reason: string } | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);

  // Kick off greeting
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runTurn([]);
    return () => {
      audioRef.current?.pause();
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function playAudio(base64: string, mime: string) {
    const audio = new Audio(`data:${mime};base64,${base64}`);
    audioRef.current = audio;
    setStatus("speaking");
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
    setStatus("idle");
  }

  async function runTurn(history: Turn[]) {
    setStatus("thinking");
    try {
      const res = await converse({ data: { messages: history } });
      const nextTurns = [...history, { role: "assistant" as const, content: res.reply }];
      setTurns(nextTurns);
      if (res.done && res.recommendation) setRecommendation(res.recommendation);
      const audio = await speak({ data: { text: res.reply } });
      await playAudio(audio.audioBase64, audio.mimeType);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Agent error");
      setStatus("idle");
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1500) {
          toast.error("Recording too short — try again");
          setStatus("idle");
          return;
        }
        setStatus("thinking");
        try {
          const b64 = await blobToBase64(blob);
          const tr = await transcribe({ data: { audioBase64: b64, mimeType: mime } });
          const text = tr.text.trim();
          if (!text) {
            toast.error("Couldn't hear you clearly");
            setStatus("idle");
            return;
          }
          const nextTurns: Turn[] = [...turns, { role: "user", content: text }];
          setTurns(nextTurns);
          await runTurn(nextTurns);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed");
          setStatus("idle");
        }
      };
      mediaRef.current = rec;
      rec.start();
      setStatus("recording");
    } catch {
      toast.error("Microphone access denied");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
  }

  const canTalk = status === "idle" && !recommendation;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-ink text-cream">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Automated Recommendation System — Voice Career Counselor</div>
              <div className="text-xs text-muted-foreground">English & Urdu · one question at a time</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[45vh] space-y-3 overflow-y-auto px-5 py-4">
          {turns.length === 0 && (
            <div className="grid place-items-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mb-2 h-5 w-5 animate-spin" />
              Automated Recommendation System is getting ready…
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${t.role === "user" ? "bg-ink text-cream" : "bg-muted text-foreground"}`}>
                {t.content}
              </div>
            </div>
          ))}
          {recommendation && (
            <div className="mt-3 rounded-xl border border-ember/40 bg-ember/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-ember">Recommended field</div>
              <div className="display mt-1 text-2xl">{recommendation.field}</div>
              <p className="mt-2 text-sm text-foreground/80">{recommendation.reason}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <div className="text-xs text-muted-foreground">
            {status === "recording" && <span className="text-destructive">● Listening…</span>}
            {status === "thinking" && "Thinking…"}
            {status === "speaking" && "Automated Recommendation System is speaking…"}
            {status === "idle" && !recommendation && "Tap the mic to answer"}
            {recommendation && "Conversation complete"}
          </div>
          {!recommendation && (
            status === "recording" ? (
              <button onClick={stopRecording} className="flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm text-cream">
                <Square className="h-4 w-4" /> Stop
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={!canTalk}
                className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm text-cream disabled:opacity-40"
              >
                {status === "thinking" || status === "speaking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                Speak
              </button>
            )
          )}
          {recommendation && (
            <button onClick={onClose} className="rounded-full bg-ink px-4 py-2 text-sm text-cream">Done</button>
          )}
        </div>
      </div>
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = reader.result as string;
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
