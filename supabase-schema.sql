-- Chiikawa Royale Supabase schema
-- Paste this whole file into Supabase SQL Editor and run it once.
-- This version is intentionally permissive so the browser app cannot get stuck on RLS.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  character text not null default 'chiikawa',
  crown_count integer not null default 0,
  gems_count integer not null default 100,
  season_level integer not null default 1,
  season_xp integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists username text,
  add column if not exists character text not null default 'chiikawa',
  add column if not exists crown_count integer not null default 0,
  add column if not exists gems_count integer not null default 100,
  add column if not exists season_level integer not null default 1,
  add column if not exists season_xp integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_username_unique
on public.profiles (username)
where username is not null;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_unique_pair unique (requester_id, addressee_id)
);

create index if not exists friendships_requester_idx on public.friendships(requester_id);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id);

-- Important: keep RLS off for now. This app is a browser-only prototype and
-- blocked RLS policies are what caused username creation/loading to fail.
alter table public.profiles disable row level security;
alter table public.friendships disable row level security;

drop policy if exists "Profiles are readable by signed in users" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Friendship participants can read" on public.friendships;
drop policy if exists "Users can send friend requests" on public.friendships;
drop policy if exists "Addressees can accept requests" on public.friendships;
drop policy if exists "Participants can delete friendships" on public.friendships;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
