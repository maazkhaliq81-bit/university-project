-- Agent automation schema additions
-- Apply this on your Supabase project.

alter table public.profiles add column if not exists is_agent_active boolean not null default false;

alter table public.job_matches add column if not exists application_status text not null default 'matched';
-- allowed values: 'matched' | 'applied' | 'recruiter_responded' | 'interviewing'

alter table public.resumes add column if not exists is_ats_optimized boolean not null default false;

create table if not exists public.agent_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.agent_logs to authenticated;
grant all on public.agent_logs to service_role;

alter table public.agent_logs enable row level security;

drop policy if exists "agent_logs owner read" on public.agent_logs;
create policy "agent_logs owner read" on public.agent_logs
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "agent_logs owner insert" on public.agent_logs;
create policy "agent_logs owner insert" on public.agent_logs
  for insert to authenticated with check (auth.uid() = user_id);

-- enable realtime
alter publication supabase_realtime add table public.agent_logs;
