create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  message_sender_id uuid not null references auth.users(id) on delete cascade,
  message_receiver_id uuid not null references auth.users(id) on delete cascade,
  reactor_user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_reactions_no_self_pair check (message_sender_id <> message_receiver_id),
  constraint message_reactions_valid_reactor check (
    reactor_user_id = message_sender_id or reactor_user_id = message_receiver_id
  ),
  constraint message_reactions_unique unique (message_id, reactor_user_id)
);

create index if not exists message_reactions_message_idx on public.message_reactions (message_id);
create index if not exists message_reactions_sender_receiver_idx
  on public.message_reactions (message_sender_id, message_receiver_id);
create index if not exists message_reactions_reactor_idx on public.message_reactions (reactor_user_id);

create or replace function public.set_message_reactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_message_reactions_updated_at on public.message_reactions;
create trigger trg_message_reactions_updated_at
before update on public.message_reactions
for each row
execute function public.set_message_reactions_updated_at();

alter table public.message_reactions enable row level security;

drop policy if exists "message_reactions_select_conversation" on public.message_reactions;
create policy "message_reactions_select_conversation"
  on public.message_reactions
  for select
  using (auth.uid() = message_sender_id or auth.uid() = message_receiver_id);

drop policy if exists "message_reactions_insert_own" on public.message_reactions;
create policy "message_reactions_insert_own"
  on public.message_reactions
  for insert
  with check (
    auth.uid() = reactor_user_id
    and (auth.uid() = message_sender_id or auth.uid() = message_receiver_id)
  );

drop policy if exists "message_reactions_update_own" on public.message_reactions;
create policy "message_reactions_update_own"
  on public.message_reactions
  for update
  using (auth.uid() = reactor_user_id)
  with check (
    auth.uid() = reactor_user_id
    and (auth.uid() = message_sender_id or auth.uid() = message_receiver_id)
  );

drop policy if exists "message_reactions_delete_own" on public.message_reactions;
create policy "message_reactions_delete_own"
  on public.message_reactions
  for delete
  using (auth.uid() = reactor_user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
exception
  when undefined_object then
    null;
end;
$$;
