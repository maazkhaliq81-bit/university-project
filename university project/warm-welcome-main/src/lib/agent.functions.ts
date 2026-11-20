import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatJSON, groqKey, GROQ_BASE_URL, type ChatMessage } from "./ai.server";

const GATEWAY = GROQ_BASE_URL;
const STT_MODEL = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";
const TTS_MODEL = process.env.GROQ_TTS_MODEL || "canopylabs/orpheus-v1-english";
const TTS_VOICE = process.env.GROQ_TTS_VOICE || "hannah";
const TTS_MAX_CHARS = 200; // Groq Orpheus per-request input limit

// Split text into chunks <= max chars, preferring sentence then word boundaries.
function chunkText(text: string, max: number): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };
  for (const s of sentences) {
    if ((cur + s).length <= max) {
      cur += s;
      continue;
    }
    push();
    if (s.length <= max) {
      cur = s;
      continue;
    }
    for (const word of s.split(" ")) {
      // Hard-split any single "word" longer than max.
      for (let i = 0; i < word.length; i += max) {
        const w = word.slice(i, i + max);
        if ((cur + " " + w).trim().length > max) push();
        cur = (cur + " " + w).trim();
      }
    }
  }
  push();
  return chunks;
}

// Merge PCM WAV files that share one format into a single WAV.
function mergeWavs(files: Uint8Array[]): Uint8Array {
  if (files.length === 1) return files[0];
  let fmt: Uint8Array | null = null;
  const pcm: Uint8Array[] = [];
  for (const f of files) {
    const v = new DataView(f.buffer, f.byteOffset, f.byteLength);
    let p = 12; // skip "RIFF" <size> "WAVE"
    while (p + 8 <= f.length) {
      const id = String.fromCharCode(f[p], f[p + 1], f[p + 2], f[p + 3]);
      const size = v.getUint32(p + 4, true);
      const start = p + 8;
      if (id === "fmt " && !fmt) fmt = f.slice(start, start + size);
      if (id === "data") {
        // Streamed WAVs may report a bogus size; clamp to file end.
        pcm.push(f.slice(start, Math.min(f.length, start + size)));
        break;
      }
      p = start + size + (size % 2);
    }
  }
  if (!fmt) throw new Error("TTS returned invalid WAV audio");
  const dataLen = pcm.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(12 + 8 + fmt.length + 8 + dataLen);
  const ov = new DataView(out.buffer);
  const tag = (o: number, s: string) => [...s].forEach((c, i) => (out[o + i] = c.charCodeAt(0)));
  tag(0, "RIFF");
  ov.setUint32(4, out.length - 8, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  ov.setUint32(16, fmt.length, true);
  out.set(fmt, 20);
  let o = 20 + fmt.length;
  tag(o, "data");
  ov.setUint32(o + 4, dataLen, true);
  o += 8;
  for (const c of pcm) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

// ---------- Transcribe audio ----------
const TranscribeInput = z.object({
  audioBase64: z.string().min(10),
  mimeType: z.string().default("audio/webm"),
});

export const agentTranscribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TranscribeInput.parse(d))
  .handler(async ({ data }) => {
    const key = groqKey();

    const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const ext =
      data.mimeType.includes("mp4") ? "mp4" :
      data.mimeType.includes("mpeg") ? "mp3" :
      data.mimeType.includes("wav") ? "wav" :
      data.mimeType.includes("ogg") ? "ogg" :
      "webm";
    const blob = new Blob([bytes], { type: data.mimeType });

    const form = new FormData();
    form.append("model", STT_MODEL);
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
- When replying in Urdu, ALWAYS write Roman Urdu (Latin letters). Never use Urdu/Arabic script — the voice engine cannot read it.
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
    const key = groqKey();

    // Orpheus accepts max 200 chars per call, so synthesize chunks and stitch.
    const parts = await Promise.all(
      chunkText(data.text, TTS_MAX_CHARS).map(async (input) => {
        const res = await fetch(`${GATEWAY}/audio/speech`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: TTS_MODEL,
            input,
            voice: TTS_VOICE,
            response_format: "wav",
          }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`TTS failed [${res.status}]: ${t}`);
        }
        return new Uint8Array(await res.arrayBuffer());
      }),
    );
    const bytes = mergeWavs(parts);
    // Base64 encode
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    return { audioBase64: b64, mimeType: "audio/wav" };
  });
