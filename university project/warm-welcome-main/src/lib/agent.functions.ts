import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatJSON, type ChatMessage } from "./ai.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

// ---------- Transcribe audio ----------
const TranscribeInput = z.object({
  audioBase64: z.string().min(10),
  mimeType: z.string().default("audio/webm"),
});

export const agentTranscribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TranscribeInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");

    const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const ext =
      data.mimeType.includes("mp4") ? "mp4" :
      data.mimeType.includes("mpeg") ? "mp3" :
      data.mimeType.includes("wav") ? "wav" :
      data.mimeType.includes("ogg") ? "ogg" :
      "webm";
    const blob = new Blob([bytes], { type: data.mimeType });

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", blob, `recording.${ext}`);

    const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Transcription failed [${res.status}]: ${t}`);
    }
    const json = (await res.json()) as { text?: string };
    return { text: json.text ?? "" };
  });

// ---------- Converse ----------
const Msg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
const ConverseInput = z.object({
  messages: z.array(Msg).max(60),
});

type AgentTurn = {
  reply: string;
  language: "en" | "ur";
  done: boolean;
  recommendation?: {
    field: string;
    reason: string;
  };
};

const SYS = `You are Automated Recommendation System, a warm, professional AI career counselor conducting a spoken voice conversation with a student.

RULES:
- Detect the user's language from their most recent message. Reply in the SAME language they used. Support English and Urdu (Roman Urdu is also Urdu).
- Speak human, natural, concise — 1 to 3 short sentences per turn. This is voice, not text.
- Ask ONLY ONE question per turn. Never stack multiple questions.
- Progress through these topics in order, but adapt naturally: (1) current status/what they do now, (2) education, (3) previous experience/projects, (4) skills they enjoy or are good at, (5) interests/what excites them, (6) goals/where they want to be.
- Acknowledge briefly ("Got it", "Achha", "Samajh gayi") before the next question when appropriate.
- Do NOT list options. Do NOT lecture. Just converse.
- After you have enough signal across most topics (usually 6-9 user turns), STOP asking and give ONE clear recommended field (e.g. "Web Development", "Data Science", "UI/UX Design", "Mobile Development", "DevOps", "Cybersecurity", "AI/ML Engineering", "Product Management") with a warm 2-3 sentence explanation of why it fits THEM specifically.

OUTPUT: Return strict JSON:
{
  "reply": "what you will say out loud, in the user's language",
  "language": "en" | "ur",
  "done": boolean,   // true only on the final recommendation turn
  "recommendation": { "field": "...", "reason": "..." } // only when done=true
}`;

export const agentConverse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConverseInput.parse(d))
  .handler(async ({ data }) => {
    const messages: ChatMessage[] = [
      { role: "system", content: SYS },
      ...data.messages.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    ];
    if (data.messages.length === 0) {
      messages.push({
        role: "user",
        content: "(The user just started the session. Greet them warmly in English, introduce yourself as Automated Recommendation System their career counselor in one short sentence, and ask what they are currently doing — study or work. Keep it under 2 sentences.)",
      });
    }
    const result = await chatJSON<AgentTurn>({
      messages,
      temperature: 0.7,
    });
    return result;
  });

// ---------- Speak ----------
const SpeakInput = z.object({
  text: z.string().min(1).max(2000),
});

export const agentSpeak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SpeakInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");

    const res = await fetch(`${GATEWAY}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: data.text,
        voice: "alloy",
        response_format: "mp3",
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`TTS failed [${res.status}]: ${t}`);
    }
    const buf = await res.arrayBuffer();
    // Base64 encode
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    return { audioBase64: b64, mimeType: "audio/mpeg" };
  });
