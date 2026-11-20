import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chat, chatJSON, type ChatMessage } from "./ai.server";

// ---------- Skill Gap Analysis ----------
const SkillGapInput = z.object({
  targetRole: z.string().min(2).max(120),
  currentSkills: z.string().max(4000),
  experience: z.string().max(2000).optional().default(""),
});

type SkillGapResult = {
  overall_score: number;
  summary: string;
  strengths: { name: string; note: string }[];
  gaps: { name: string; priority: "high" | "medium" | "low"; predicted_struggle: string; why: string }[];
  learning_path: { step: number; topic: string; resources: string[]; estimated_weeks: number }[];
  market_signal: { demand: "low" | "medium" | "high" | "very high"; salary_range_usd: string; trend: string };
};

export const runSkillGap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SkillGapInput.parse(d))
  .handler(async ({ data, context }) => {
    const sys = `You are an expert career coach and skills assessor. Analyze skill gaps for the target role.
Predict which concepts the student will likely struggle with based on their stated skills and experience.
Return strict JSON matching this schema:
{
  "overall_score": number 0-100,
  "summary": "2-3 sentence overview",
  "strengths": [{"name":"","note":""}],
  "gaps": [{"name":"","priority":"high|medium|low","predicted_struggle":"specific concept they'll hit","why":"reason grounded in their profile"}],
  "learning_path": [{"step":1,"topic":"","resources":["url or resource name"],"estimated_weeks":number}],
  "market_signal": {"demand":"low|medium|high|very high","salary_range_usd":"$X-$Y","trend":"1 sentence"}
}`;
    const user = `Target role: ${data.targetRole}
Current skills: ${data.currentSkills}
Experience: ${data.experience || "(not provided)"}`;
    const result = await chatJSON<SkillGapResult>({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.4,
    });

    const { data: saved, error } = await context.supabase
      .from("skill_assessments")
      .insert({
        user_id: context.userId,
        target_role: data.targetRole,
        current_skills: data.currentSkills,
        analysis: result,
        overall_score: Math.round(result.overall_score),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const listSkillAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("skill_assessments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data;
  });

// ---------- Resume optimization ----------
const ResumeInput = z.object({
  content: z.string().min(50).max(30000),
  targetRole: z.string().min(2).max(120),
});

type ResumeResult = {
  ats_score: number;
  keyword_coverage: { present: string[]; missing: string[] };
  strengths: string[];
  issues: { section: string; issue: string; suggestion: string; severity: "high" | "medium" | "low" }[];
  rewrite_suggestions: { original: string; improved: string; reason: string }[];
  summary: string;
};

export const analyzeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResumeInput.parse(d))
  .handler(async ({ data, context }) => {
    const sys = `You are a senior recruiter and ATS expert. Analyze the resume for the target role.
Return strict JSON:
{
  "ats_score": 0-100,
  "keyword_coverage": {"present":[""],"missing":[""]},
  "strengths": [""],
  "issues": [{"section":"","issue":"","suggestion":"","severity":"high|medium|low"}],
  "rewrite_suggestions": [{"original":"","improved":"","reason":""}],
  "summary": "2-3 sentence recruiter perspective"
}`;
    const user = `TARGET ROLE: ${data.targetRole}\n\nRESUME:\n${data.content}`;
    const result = await chatJSON<ResumeResult>({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.3,
    });
    const { data: saved, error } = await context.supabase
      .from("resumes")
      .insert({
        user_id: context.userId,
        content: data.content,
        target_role: data.targetRole,
        ats_score: Math.round(result.ats_score),
        analysis: result,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const listResumes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("resumes")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data;
  });

// ---------- Interview Simulator ----------
const StartInterviewInput = z.object({
  role: z.string().min(2).max(120),
  type: z.enum(["technical", "behavioral", "mixed"]).default("technical"),
});
const InterviewTurnInput = z.object({
  sessionId: z.string().uuid(),
  answer: z.string().min(1).max(8000),
});
const FinishInterviewInput = z.object({ sessionId: z.string().uuid() });

export const startInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartInterviewInput.parse(d))
  .handler(async ({ data, context }) => {
    const sys = `You are a senior interviewer for a ${data.role} role conducting a ${data.type} interview.
Ask ONE question at a time. Keep it concise and realistic. Start with a warm intro then the first question.`;
    const opening = await chat({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: "Please start the interview with your first question." },
      ],
      temperature: 0.7,
    });
    const transcript = [{ role: "assistant", content: opening }];
    const { data: session, error } = await context.supabase
      .from("interview_sessions")
      .insert({
        user_id: context.userId,
        role: data.role,
        interview_type: data.type,
        transcript,
        status: "active",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return session;
  });

export const nextInterviewTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InterviewTurnInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: session, error } = await context.supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    const transcript = (session.transcript as { role: string; content: string }[]) ?? [];
    transcript.push({ role: "user", content: data.answer });
    const sys = `You are a senior interviewer for a ${session.role} role (${session.interview_type}).
After the candidate answers: give a very short (1 sentence) reaction, then ask the next question.
If you've asked 5+ questions, say "Great — I have what I need to give you feedback." and stop asking.`;
    const messages: ChatMessage[] = [{ role: "system", content: sys }];
    for (const t of transcript) messages.push({ role: t.role as ChatMessage["role"], content: t.content });
    const reply = await chat({ messages, temperature: 0.7 });
    transcript.push({ role: "assistant", content: reply });

    const done = /have what I need/i.test(reply);
    const { data: updated, error: uerr } = await context.supabase
      .from("interview_sessions")
      .update({ transcript, status: done ? "finishing" : "active" })
      .eq("id", data.sessionId)
      .select()
      .single();
    if (uerr) throw new Error(uerr.message);
    return updated;
  });

type InterviewEval = {
  overall_score: number;
  technical: { score: number; notes: string };
  problem_solving: { score: number; notes: string };
  communication: { score: number; notes: string };
  behavioral: { score: number; notes: string };
  strengths: string[];
  improvements: string[];
  hire_recommendation: "strong_yes" | "yes" | "maybe" | "no";
};

export const finishInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FinishInterviewInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: session, error } = await context.supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    const transcript = session.transcript as { role: string; content: string }[];
    const convo = transcript.map((t) => `${t.role.toUpperCase()}: ${t.content}`).join("\n\n");
    const sys = `Evaluate the candidate for a ${session.role} role (${session.interview_type}).
Return strict JSON:
{"overall_score":0-100,"technical":{"score":0-100,"notes":""},"problem_solving":{"score":0-100,"notes":""},"communication":{"score":0-100,"notes":""},"behavioral":{"score":0-100,"notes":""},"strengths":[""],"improvements":[""],"hire_recommendation":"strong_yes|yes|maybe|no"}`;
    const evaluation = await chatJSON<InterviewEval>({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: convo },
      ],
      temperature: 0.3,
    });
    const { data: updated, error: uerr } = await context.supabase
      .from("interview_sessions")
      .update({ status: "complete", evaluation, overall_score: Math.round(evaluation.overall_score) })
      .eq("id", data.sessionId)
      .select()
      .single();
    if (uerr) throw new Error(uerr.message);
    return updated;
  });

export const listInterviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("interview_sessions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data;
  });

// ---------- GitHub Portfolio Builder ----------
const PortfolioInput = z.object({ githubUsername: z.string().min(1).max(60) });

type RepoRaw = {
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  topics?: string[];
  updated_at: string;
};

export const buildPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PortfolioInput.parse(d))
  .handler(async ({ data, context }) => {
    const username = data.githubUsername.trim();
    // Fetch user + repos from GitHub public API
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, {
        headers: { Accept: "application/vnd.github+json" },
      }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, {
        headers: { Accept: "application/vnd.github+json" },
      }),
    ]);
    if (!userRes.ok) throw new Error(`GitHub user not found: ${username}`);
    if (!reposRes.ok) throw new Error(`Could not fetch repos for ${username}`);
    const user = (await userRes.json()) as { bio: string | null; name: string | null; avatar_url: string };
    const reposRaw = (await reposRes.json()) as RepoRaw[];
    const repos = reposRaw
      .filter((r) => !r.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 8);

    const sys = `You are a portfolio writer. For each repo, write a compelling 1-2 sentence project description that highlights impact.
Also write a 2-sentence bio for the developer. Return strict JSON:
{"bio":"","projects":[{"name":"","url":"","language":"","stars":0,"description":"","tech":[""]}]}`;
    const payload = {
      bio_hint: user.bio,
      name: user.name,
      repos: repos.map((r) => ({
        name: r.name,
        url: r.html_url,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        topics: r.topics ?? [],
      })),
    };
    const result = await chatJSON<{
      bio: string;
      projects: { name: string; url: string; language: string; stars: number; description: string; tech: string[] }[];
    }>({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(payload) },
      ],
      temperature: 0.5,
    });

    const { data: saved, error } = await context.supabase
      .from("portfolios")
      .upsert(
        {
          user_id: context.userId,
          github_username: username,
          bio: result.bio,
          projects: result.projects,
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();
    if (error) {
      // upsert without unique constraint — fallback to insert
      const { data: inserted, error: ie } = await context.supabase
        .from("portfolios")
        .insert({
          user_id: context.userId,
          github_username: username,
          bio: result.bio,
          projects: result.projects,
        })
        .select()
        .single();
      if (ie) throw new Error(ie.message);
      return { ...inserted, avatar_url: user.avatar_url };
    }
    return { ...saved, avatar_url: user.avatar_url };
  });

export const getMyPortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("portfolios")
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

// ---------- AI Career Agent ----------
const AgentSendInput = z.object({
  conversationId: z.string().uuid().nullable(),
  message: z.string().min(1).max(6000),
});

export const sendAgentMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AgentSendInput.parse(d))
  .handler(async ({ data, context }) => {
    let conversationId = data.conversationId;
    if (!conversationId) {
      const title = data.message.slice(0, 60);
      const { data: conv, error } = await context.supabase
        .from("agent_conversations")
        .insert({ user_id: context.userId, title })
        .select()
        .single();
      if (error) throw new Error(error.message);
      conversationId = conv.id as string;
    }

    // Pull profile + recent history for context
    const [{ data: profile }, { data: history }] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("agent_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(40),
    ]);

    await context.supabase.from("agent_messages").insert({
      conversation_id: conversationId,
      user_id: context.userId,
      role: "user",
      content: data.message,
    });

    const sys = `You are Automated Recommendation System, a friendly, sharp AI career agent for students.
You give concrete, actionable advice on careers, skills, interviews, resumes, and portfolios.
Use markdown. Be concise but warm. When helpful, suggest which feature of this app to use next
(Skill Gap Analysis, Resume Optimizer, Mock Interview, Portfolio Builder).
Student profile: ${JSON.stringify({
      name: profile?.display_name,
      target_role: profile?.target_role,
      headline: profile?.headline,
      github: profile?.github_username,
    })}`;

    const messages: ChatMessage[] = [{ role: "system", content: sys }];
    for (const m of history ?? []) messages.push({ role: m.role as ChatMessage["role"], content: m.content });
    messages.push({ role: "user", content: data.message });

    const reply = await chat({ messages, temperature: 0.7 });

    await context.supabase.from("agent_messages").insert({
      conversation_id: conversationId,
      user_id: context.userId,
      role: "assistant",
      content: reply,
    });

    return { conversationId, reply };
  });

export const listAgentConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agent_conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data;
  });

export const getAgentMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: msgs, error } = await context.supabase
      .from("agent_messages")
      .select("*")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return msgs;
  });

const ConvIdInput = z.object({ conversationId: z.string().uuid() });
const RenameInput = z.object({ conversationId: z.string().uuid(), title: z.string().min(1).max(120) });

export const renameAgentConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RenameInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("agent_conversations")
      .update({ title: data.title })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAgentConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConvIdInput.parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("agent_messages").delete().eq("conversation_id", data.conversationId);
    const { error } = await context.supabase
      .from("agent_conversations")
      .delete()
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const togglePinAgentConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid(), pinned: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("agent_conversations")
      .update({ pinned: data.pinned })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ---------- Profile ----------
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    return data;
  });

const UpdateProfileInput = z.object({
  display_name: z.string().max(120).optional(),
  headline: z.string().max(200).optional(),
  target_role: z.string().max(120).optional(),
  github_username: z.string().max(60).optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

// =========================================================
// New learning-loop modules
// =========================================================

// ---------- Skills Assessment (questionnaire) ----------
const AssessmentGenerateInput = z.object({ targetRole: z.string().min(2).max(120) });
type AssessmentQuestion = { id: string; question: string; concept: string; options: string[] };

export const generateAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AssessmentGenerateInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `Generate a 10-question multiple-choice skills baseline questionnaire for someone targeting: ${data.targetRole}.
Mix easy, medium, hard. Cover foundational + intermediate concepts. Return strict JSON:
{"questions":[{"id":"q1","question":"","concept":"topic name","options":["A","B","C","D"]}]}
Do NOT include the answer. Options should be plausible.`;
    const out = await chatJSON<{ questions: AssessmentQuestion[] }>({
      messages: [{ role: "system", content: sys }, { role: "user", content: data.targetRole }],
      temperature: 0.5,
    });
    return out.questions;
  });

const AssessmentSubmitInput = z.object({
  targetRole: z.string().min(2).max(120),
  questions: z.array(z.object({ id: z.string(), question: z.string(), concept: z.string(), options: z.array(z.string()) })),
  answers: z.array(z.object({ id: z.string(), choice: z.string() })),
});

export const submitAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AssessmentSubmitInput.parse(d))
  .handler(async ({ data, context }) => {
    const sys = `Grade this skills questionnaire for a "${data.targetRole}" candidate. Determine the correct option for each question, mark right/wrong, compute overall level.
Return strict JSON:
{"level":"beginner|intermediate|advanced","score":0-100,"summary":"","concept_scores":[{"concept":"","correct":0,"total":0}],"strong_concepts":[""],"weak_concepts":[""]}`;
    const payload = { questions: data.questions, answers: data.answers };
    const verdict = await chatJSON<{ level: string; score: number; summary: string; concept_scores: unknown[]; strong_concepts: string[]; weak_concepts: string[] }>({
      messages: [{ role: "system", content: sys }, { role: "user", content: JSON.stringify(payload) }],
      temperature: 0.2,
    });
    const { data: saved, error } = await context.supabase
      .from("assessments")
      .insert({ user_id: context.userId, target_role: data.targetRole, answers: data.answers, verdict: verdict as never, level: verdict.level })
      .select().single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const listAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("assessments").select("*").order("created_at", { ascending: false }).limit(10);
    if (error) throw new Error(error.message);
    return data;
  });

// ---------- Course Aggregator ----------
const CourseSearchInput = z.object({ topic: z.string().min(2).max(120), level: z.string().max(40).optional() });
type CourseSuggestion = { title: string; url: string; source: string; difficulty: string; relevance: number; reason: string };

export const searchCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CourseSearchInput.parse(d))
  .handler(async ({ data, context }) => {
    const sys = `You are a curriculum curator. Suggest 8 high-quality YouTube videos or free online courses on "${data.topic}" for a ${data.level ?? "beginner-to-intermediate"} learner.
Prefer well-known channels (freeCodeCamp, Fireship, Traversy Media, The Net Ninja, Corey Schafer, MIT OCW, CS50, StatQuest, 3Blue1Brown, Krish Naik, etc). Use real YouTube search URLs when unsure of exact video: https://www.youtube.com/results?search_query=...
Return strict JSON:
{"items":[{"title":"","url":"https://...","source":"youtube|web","difficulty":"beginner|intermediate|advanced","relevance":0-100,"reason":"1 sentence"}]}
Rank by relevance desc, difficulty ascending.`;
    const out = await chatJSON<{ items: CourseSuggestion[] }>({
      messages: [{ role: "system", content: sys }, { role: "user", content: `Topic: ${data.topic}` }],
      temperature: 0.5,
    });
    // Save to DB for tracking
    const rows = out.items.map((it) => ({
      user_id: context.userId,
      topic: data.topic,
      title: it.title,
      url: it.url,
      source: it.source ?? "youtube",
      difficulty: it.difficulty,
      relevance: Math.round(it.relevance),
      reason: it.reason,
    }));
    const { data: saved, error } = await context.supabase.from("courses").insert(rows).select();
    if (error) throw new Error(error.message);
    return saved;
  });

export const listCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("courses").select("*").order("created_at", { ascending: false }).limit(80);
    if (error) throw new Error(error.message);
    return data;
  });

export const toggleCourseComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), completed: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("courses").update({ completed: data.completed }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Quiz ----------
const GenerateQuizInput = z.object({ courseId: z.string().uuid().optional(), topic: z.string().min(2).max(200), context: z.string().max(2000).optional() });
type QuizQuestion = { id: string; question: string; options: string[]; correct: string; concept: string; explanation: string };

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateQuizInput.parse(d))
  .handler(async ({ data, context }) => {
    const sys = `Generate an 8-question mock quiz to test comprehension of "${data.topic}". Mix concept understanding + application.
Return strict JSON:
{"questions":[{"id":"q1","question":"","options":["A","B","C","D"],"correct":"A","concept":"","explanation":"1-2 sentences"}]}`;
    const out = await chatJSON<{ questions: QuizQuestion[] }>({
      messages: [{ role: "system", content: sys }, { role: "user", content: data.context ?? data.topic }],
      temperature: 0.5,
    });
    const { data: saved, error } = await context.supabase
      .from("quizzes")
      .insert({ user_id: context.userId, course_id: data.courseId ?? null, topic: data.topic, questions: out.questions })
      .select().single();
    if (error) throw new Error(error.message);
    return saved;
  });

const SubmitQuizInput = z.object({ quizId: z.string().uuid(), answers: z.array(z.object({ id: z.string(), choice: z.string() })) });

export const submitQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubmitQuizInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: quiz, error } = await context.supabase.from("quizzes").select("*").eq("id", data.quizId).single();
    if (error) throw new Error(error.message);
    const questions = quiz.questions as QuizQuestion[];
    const weakMap = new Map<string, { total: number; wrong: number }>();
    let correct = 0;
    for (const q of questions) {
      const a = data.answers.find((x) => x.id === q.id);
      const rec = weakMap.get(q.concept) ?? { total: 0, wrong: 0 };
      rec.total++;
      if (a?.choice === q.correct) correct++;
      else rec.wrong++;
      weakMap.set(q.concept, rec);
    }
    const score = Math.round((correct / questions.length) * 100);
    const weak = Array.from(weakMap.entries())
      .filter(([, v]) => v.wrong / v.total >= 0.5)
      .map(([concept, v]) => ({ concept, wrong: v.wrong, total: v.total }));
    const { data: updated, error: uerr } = await context.supabase
      .from("quizzes")
      .update({ answers: data.answers, score, weak_concepts: weak })
      .eq("id", data.quizId).select().single();
    if (uerr) throw new Error(uerr.message);
    // log study session (today)
    const today = new Date().toISOString().slice(0, 10);
    await context.supabase.from("study_sessions").upsert(
      { user_id: context.userId, day: today, minutes: 10 },
      { onConflict: "user_id,day" },
    );
    return updated;
  });

export const listQuizzes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("quizzes").select("*").order("created_at", { ascending: false }).limit(30);
    if (error) throw new Error(error.message);
    return data;
  });

// ---------- Roadmap ----------
const GenerateRoadmapInput = z.object({ targetRole: z.string().min(2).max(120), level: z.string().max(40).optional() });

type RoadmapResource = { title: string; url: string; source: "youtube" | "web"; difficulty: "beginner" | "intermediate" | "advanced"; duration: string; description: string };
type RoadmapSubTopic = { id: string; title: string; description: string; completed: boolean; resources: RoadmapResource[] };

const YOUTUBE_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

function extractYoutubeVideoId(url: string): string | null {
  const raw = url.trim();
  const match = raw.match(/(?:youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (match?.[1] && YOUTUBE_VIDEO_ID.test(match[1])) return match[1];

  try {
    const parsed = new URL(raw);
    const id = parsed.searchParams.get("v");
    return id && YOUTUBE_VIDEO_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

function toYoutubeWatchUrl(url: string): string | null {
  const videoId = extractYoutubeVideoId(url);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

// Resolve a YouTube search query to the first matching watch URL by scraping the results page.
// Returns null on any failure so callers can keep the original URL as a fallback.
async function resolveYoutubeVideoUrl(query: string): Promise<string | null> {
  try {
    const direct = toYoutubeWatchUrl(query);
    if (direct) return direct;

    const q = encodeURIComponent(query.trim());
    const res = await fetch(`https://www.youtube.com/results?search_query=${q}&sp=EgIQAQ%253D%253D`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (!m) return null;
    return `https://www.youtube.com/watch?v=${m[1]}`;
  } catch {
    return null;
  }
}

async function attachYoutubeVideos(
  subTopicTitle: string,
  resources: RoadmapResource[],
): Promise<RoadmapResource[]> {
  return Promise.all(
    resources.map(async (r) => {
      if (r.source !== "youtube") return r;
      const direct = toYoutubeWatchUrl(r.url);
      if (direct) return { ...r, url: direct };
      const query = `${r.title || subTopicTitle} ${subTopicTitle} tutorial`;
      const resolved = await resolveYoutubeVideoUrl(query);
      return resolved ? { ...r, url: resolved } : r;
    }),
  );
}

export const generateRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateRoadmapInput.parse(d))
  .handler(async ({ data, context }) => {
    const sys = `Create a comprehensive step-by-step learning roadmap of 6-10 major PHASES for someone targeting "${data.targetRole}" (${data.level ?? "beginner"}).
For each phase, break it into 4-8 ordered SUB-TOPICS that must be learned sequentially. For each sub-topic, suggest 2-4 high-quality resources (YouTube videos or free courses).
Prefer well-known channels/platforms (freeCodeCamp, Fireship, Traversy Media, The Net Ninja, Corey Schafer, MIT OCW, CS50, StatQuest, 3Blue1Brown, Krish Naik, MDN, official docs). When unsure of an exact video URL, use a YouTube search URL: https://www.youtube.com/results?search_query=...
Return STRICT JSON:
{"items":[{
  "topic":"Phase name",
  "description":"1 sentence overview",
  "estimated_weeks": number,
  "sub_topics":[{
    "title":"Sub-topic name",
    "description":"1 sentence why this matters",
    "resources":[{"title":"","url":"https://...","source":"youtube|web","difficulty":"beginner|intermediate|advanced","duration":"e.g. 15 min or 3h","description":"1 sentence"}]
  }]
}]}`;
    const out = await chatJSON<{ items: { topic: string; description: string; estimated_weeks: number; sub_topics: { title: string; description: string; resources: RoadmapResource[] }[] }[] }>({
      messages: [{ role: "system", content: sys }, { role: "user", content: `Target role: ${data.targetRole}` }],
      temperature: 0.4,
    });
    await context.supabase.from("roadmap_items").delete().eq("user_id", context.userId);
    const rows = await Promise.all(
      out.items.map(async (it, i) => ({
        user_id: context.userId,
        topic: it.topic,
        description: it.description,
        estimated_weeks: it.estimated_weeks,
        position: i,
        status: "todo",
        sub_topics: (await Promise.all(
          (it.sub_topics ?? []).map(async (s, j) => ({
            id: `s${i}-${j}-${Math.random().toString(36).slice(2, 8)}`,
            title: s.title,
            description: s.description,
            completed: false,
            resources: await attachYoutubeVideos(s.title, (s.resources ?? []).slice(0, 5)),
          })),
        )) as RoadmapSubTopic[],
      })),
    );
    const { data: saved, error } = await context.supabase.from("roadmap_items").insert(rows).select();
    if (error) throw new Error(error.message);
    return saved;
  });

export const listRoadmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("roadmap_items").select("*").order("position", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = data ?? [];

    return Promise.all(
      rows.map(async (row) => {
        const subTopics = ((row.sub_topics as RoadmapSubTopic[] | null) ?? []);
        let changed = false;

        const normalizedSubTopics = await Promise.all(
          subTopics.map(async (subTopic) => {
            const resources = await Promise.all(
              (subTopic.resources ?? []).map(async (resource) => {
                if (resource.source !== "youtube") return resource;

                const direct = toYoutubeWatchUrl(resource.url);
                if (direct) {
                  if (direct !== resource.url) changed = true;
                  return { ...resource, url: direct };
                }

                const resolved = await resolveYoutubeVideoUrl(`${resource.title || subTopic.title} ${subTopic.title} tutorial`);
                if (!resolved) return resource;
                changed = true;
                return { ...resource, url: resolved };
              }),
            );

            return { ...subTopic, resources };
          }),
        );

        if (changed) {
          await context.supabase.from("roadmap_items").update({ sub_topics: normalizedSubTopics }).eq("id", row.id);
        }

        return { ...row, sub_topics: normalizedSubTopics };
      }),
    );
  });

export const setRoadmapStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["todo", "doing", "done"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("roadmap_items").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleSubtopicComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemId: z.string().uuid(), subtopicId: z.string(), completed: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("roadmap_items").select("sub_topics").eq("id", data.itemId).single();
    if (error) throw new Error(error.message);
    const subs = ((row.sub_topics as RoadmapSubTopic[] | null) ?? []).map((s) =>
      s.id === data.subtopicId ? { ...s, completed: data.completed } : s,
    );
    const allDone = subs.length > 0 && subs.every((s) => s.completed);
    const anyDone = subs.some((s) => s.completed);
    const nextStatus = allDone ? "done" : anyDone ? "doing" : "todo";
    const { error: uerr } = await context.supabase.from("roadmap_items").update({ sub_topics: subs, status: nextStatus }).eq("id", data.itemId);
    if (uerr) throw new Error(uerr.message);
    const today = new Date().toISOString().slice(0, 10);
    await context.supabase.from("study_sessions").upsert({ user_id: context.userId, day: today, minutes: 5 }, { onConflict: "user_id,day" });
    return { ok: true, status: nextStatus };
  });

// ---------- CV Builder ----------
const CvData = z.object({
  full_name: z.string().max(120).default(""),
  headline: z.string().max(200).default(""),
  email: z.string().max(200).default(""),
  phone: z.string().max(60).default(""),
  location: z.string().max(120).default(""),
  links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  summary: z.string().max(1200).default(""),
  experience: z.array(z.object({ role: z.string(), company: z.string(), period: z.string(), bullets: z.array(z.string()) })).default([]),
  education: z.array(z.object({ school: z.string(), degree: z.string(), period: z.string() })).default([]),
  skills: z.array(z.string()).default([]),
  projects: z.array(z.object({ name: z.string(), description: z.string(), url: z.string().optional() })).default([]),
});

export const saveCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional(), title: z.string().max(120).default("My CV"), template: z.string().default("minimal"), data: CvData }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: updated, error } = await context.supabase
        .from("cv_documents")
        .update({ title: data.title, template: data.template, data: data.data })
        .eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: saved, error } = await context.supabase
      .from("cv_documents")
      .insert({ user_id: context.userId, title: data.title, template: data.template, data: data.data })
      .select().single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const getMyCv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("cv_documents").select("*").eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    return data;
  });

// ---------- Job Matcher ----------
const JobMatchInput = z.object({ targetRole: z.string().min(2).max(120), level: z.string().max(40), skills: z.string().max(2000).optional() });

const buildApplyLinks = (title: string, company: string, location: string) => {
  const q = (s: string) => encodeURIComponent(s.trim());
  const kw = q(`${title} ${company}`.trim());
  const loc = q(location || "");
  const companyKw = q(company || "");
  return [
    {
      source: "LinkedIn",
      // Deep-linked jobs listing scoped to this role at this company (not a bare search).
      url: `https://www.linkedin.com/jobs/search/?keywords=${kw}${loc ? `&location=${loc}` : ""}&f_TPR=r604800`,
    },
    {
      source: "Indeed",
      url: `https://www.indeed.com/jobs?q=${q(title)}+${companyKw}${loc ? `&l=${loc}` : ""}`,
    },
    {
      source: "Glassdoor",
      url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${kw}${loc ? `&locKeyword=${loc}` : ""}`,
    },
    {
      source: "Wellfound",
      url: `https://wellfound.com/jobs?q=${kw}`,
    },
  ];
};

export const generateJobMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobMatchInput.parse(d))
  .handler(async ({ data, context }) => {
    const sys = `Generate 8 realistic entry-appropriate job openings for a ${data.level} "${data.targetRole}". Illustrative examples matched to skill level. Vary companies (mix real well-known + realistic startups), remote/onsite, salary bands in local currency where sensible.
Return strict JSON:
{"jobs":[{"title":"","company":"","location":"","employment_type":"Full-time|Part-time|Contract|Internship","experience":"e.g. 0-2 years","salary_range":"e.g. $70k - $90k or empty string","level":"","fit_score":0-100,"skills":["5-8 items"],"description":"2 concise sentences"}]}`;
    const user = `Target: ${data.targetRole}\nLevel: ${data.level}\nSkills: ${data.skills ?? "(unknown)"}`;
    const out = await chatJSON<{ jobs: { title: string; company: string; location: string; employment_type?: string; experience?: string; salary_range?: string; level: string; fit_score: number; skills: string[]; description: string }[] }>({
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      temperature: 0.6,
    });
    await context.supabase.from("job_matches").delete().eq("user_id", context.userId);
    const rows = out.jobs.map((j) => {
      const links = buildApplyLinks(j.title, j.company || "", j.location || "");
      return {
        user_id: context.userId,
        title: j.title,
        company: j.company,
        location: j.location,
        level: j.level,
        employment_type: j.employment_type ?? null,
        experience: j.experience ?? null,
        salary_range: j.salary_range ?? null,
        fit_score: Math.round(j.fit_score),
        skills: j.skills,
        description: j.description,
        url: links[0].url,
        apply_links: links,
      };
    });
    const { data: saved, error } = await context.supabase.from("job_matches").insert(rows).select();
    if (error) throw new Error(error.message);
    return saved;
  });

export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("job_matches").select("*").order("fit_score", { ascending: false }).limit(30);
    if (error) throw new Error(error.message);
    // Backfill apply_links for legacy rows.
    return (data ?? []).map((j) => {
      const raw = (j as { apply_links?: unknown }).apply_links;
      const links = Array.isArray(raw) && raw.length > 0
        ? (raw as { source: string; url: string }[])
        : buildApplyLinks(j.title, j.company ?? "", j.location ?? "");
      return { ...j, apply_links: links };
    });

  });


// ---------- Progress / streak ----------
export const logStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ minutes: z.number().min(1).max(600) }).parse(d))
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await context.supabase.from("study_sessions").select("*").eq("user_id", context.userId).eq("day", today).maybeSingle();
    const minutes = (existing?.minutes ?? 0) + data.minutes;
    const { error } = await context.supabase.from("study_sessions").upsert(
      { user_id: context.userId, day: today, minutes },
      { onConflict: "user_id,day" },
    );
    if (error) throw new Error(error.message);
    return { minutes };
  });

export const getProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: sessions }, { data: quizzes }, { data: courses }, { data: roadmap }] = await Promise.all([
      context.supabase.from("study_sessions").select("*").order("day", { ascending: true }).limit(90),
      context.supabase.from("quizzes").select("id, topic, score, weak_concepts, created_at").order("created_at", { ascending: true }).limit(50),
      context.supabase.from("courses").select("id, completed").limit(500),
      context.supabase.from("roadmap_items").select("status").limit(200),
    ]);
    // streak calculation
    const days = new Set((sessions ?? []).map((s) => s.day));
    let streak = 0;
    const cursor = new Date();
    while (days.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    const conceptTally = new Map<string, number>();
    for (const q of quizzes ?? []) {
      const weak = (q.weak_concepts as { concept: string }[] | null) ?? [];
      for (const w of weak) conceptTally.set(w.concept, (conceptTally.get(w.concept) ?? 0) + 1);
    }
    const weakConcepts = Array.from(conceptTally.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([concept, count]) => ({ concept, count }));
    return {
      streak,
      sessions: sessions ?? [],
      quizzes: quizzes ?? [],
      courses_completed: (courses ?? []).filter((c) => c.completed).length,
      courses_total: (courses ?? []).length,
      roadmap_done: (roadmap ?? []).filter((r) => r.status === "done").length,
      roadmap_total: (roadmap ?? []).length,
      weak_concepts: weakConcepts,
    };
  });

// ---------- Weak-skill resource recommender (post-assessment) ----------
const WeakSkillResourcesInput = z.object({
  targetRole: z.string().min(2).max(120),
  weakConcepts: z.array(z.string().min(1).max(160)).min(1).max(12),
});

type WeakSkillVideo = {
  title: string;
  channel: string;
  duration: string;
  url: string;
  videoId: string | null;
  thumbnail: string | null;
};
type WeakSkillPack = {
  concept: string;
  priority: "high" | "medium" | "low";
  estimated_hours: number;
  why_it_matters: string;
  videos: WeakSkillVideo[];
  docs: { title: string; url: string }[];
  practice: { title: string; url: string }[];
  projects: { title: string; description: string }[];
};

export const recommendWeakSkillResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => WeakSkillResourcesInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `You are a professional AI career coach. For each weak skill/concept listed, recommend a high-quality learning pack for someone targeting "${data.targetRole}".
For EACH concept return:
- 3-5 YouTube videos from well-known channels (freeCodeCamp, Fireship, Traversy Media, The Net Ninja, Corey Schafer, MIT OCW, CS50, StatQuest, 3Blue1Brown, Krish Naik, Web Dev Simplified, Programming with Mosh, etc.). Include realistic title, channel, duration like "18:42" or "1:22:05". For "url" always use https://www.youtube.com/results?search_query=<channel>+<exact video title> when you don't know the exact video id.
- 2-4 official documentation / authoritative reading links (MDN, official docs, W3C, textbooks).
- 2-3 practice websites (LeetCode, HackerRank, Codewars, Frontend Mentor, Kaggle, Exercism, etc.) with direct URLs.
- 2-3 mini project ideas ordered easy -> harder with a 1-sentence description each.
- priority (high|medium|low) and estimated_hours (integer) to reach solid competency.
Return STRICT JSON only:
{"packs":[{"concept":"","priority":"high|medium|low","estimated_hours":0,"why_it_matters":"1 sentence","videos":[{"title":"","channel":"","duration":"","url":"https://..."}],"docs":[{"title":"","url":""}],"practice":[{"title":"","url":""}],"projects":[{"title":"","description":""}]}]}`;
    const out = await chatJSON<{ packs: WeakSkillPack[] }>({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Target role: ${data.targetRole}\nWeak concepts: ${data.weakConcepts.join(", ")}` },
      ],
      temperature: 0.4,
    });

    // Resolve each video URL to a real watch URL and attach thumbnail
    const packs = await Promise.all(
      (out.packs ?? []).map(async (pack) => {
        const videos = await Promise.all(
          (pack.videos ?? []).slice(0, 5).map(async (v) => {
            const direct = toYoutubeWatchUrl(v.url);
            const resolved = direct ?? (await resolveYoutubeVideoUrl(`${v.channel} ${v.title} ${pack.concept}`));
            const finalUrl = resolved ?? v.url;
            const videoId = finalUrl ? extractYoutubeVideoId(finalUrl) : null;
            const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
            return { ...v, url: finalUrl, videoId, thumbnail };
          }),
        );
        return { ...pack, videos };
      }),
    );

    return packs;
  });

