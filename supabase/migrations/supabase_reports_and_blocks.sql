-- Apple Guideline 1.2: block + report moderation support

-- 1) Block relationship persisted server-side
create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocked_users_no_self_block check (blocker_id <> blocked_user_id),
  constraint blocked_users_unique_pair unique (blocker_id, blocked_user_id)
);

create index if not exists blocked_users_blocker_idx on public.blocked_users (blocker_id);
create index if not exists blocked_users_blocked_idx on public.blocked_users (blocked_user_id);

alter table public.blocked_users enable row level security;

drop policy if exists "blocked_users_select_own" on public.blocked_users;
create policy "blocked_users_select_own"
  on public.blocked_users
  for select
  using (auth.uid() = blocker_id);

drop policy if exists "blocked_users_insert_own" on public.blocked_users;
create policy "blocked_users_insert_own"
  on public.blocked_users
  for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "blocked_users_delete_own" on public.blocked_users;
create policy "blocked_users_delete_own"
  on public.blocked_users
  for delete
  using (auth.uid() = blocker_id);

-- 2) Reports for UGC moderation
create table if not exists public.reports (
  report_id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid null,
  reason text not null check (reason in ('spam', 'harassment', 'hate_speech', 'explicit_content', 'other')),
  note text null,
  message_created_at timestamptz null,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  constraint reports_no_self_report check (reporter_user_id <> reported_user_id)
);

create index if not exists reports_status_created_idx on public.reports (status, created_at desc);
create index if not exists reports_reported_user_idx on public.reports (reported_user_id);
create index if not exists reports_reporter_user_idx on public.reports (reporter_user_id);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports
  for insert
  with check (auth.uid() = reporter_user_id);

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own"
  on public.reports
  for select
  using (auth.uid() = reporter_user_id);

-- 3) Minimal moderation visibility (service role bypasses RLS).
-- Query for moderators/admin tooling:
-- select * from public.reports where status = 'pending' order by created_at asc;
