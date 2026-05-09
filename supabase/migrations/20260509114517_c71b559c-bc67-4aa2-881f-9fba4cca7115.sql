
-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Threads
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.threads enable row level security;
create policy "own threads select" on public.threads for select using (auth.uid() = user_id);
create policy "own threads insert" on public.threads for insert with check (auth.uid() = user_id);
create policy "own threads update" on public.threads for update using (auth.uid() = user_id);
create policy "own threads delete" on public.threads for delete using (auth.uid() = user_id);
create index threads_user_idx on public.threads(user_id, updated_at desc);

-- Messages: store full UIMessage as JSONB
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  message jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "own messages select" on public.messages for select using (auth.uid() = user_id);
create policy "own messages insert" on public.messages for insert with check (auth.uid() = user_id);
create policy "own messages delete" on public.messages for delete using (auth.uid() = user_id);
create index messages_thread_idx on public.messages(thread_id, created_at);
