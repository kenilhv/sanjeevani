-- Sanjeevni Supabase schema (contracts.md section 7).
-- Paste into Supabase Dashboard -> SQL Editor -> Run. Safe to run twice.
-- Supabase holds identity, audio evidence and the long-term audit record. Live patient state stays in the actors.

create table if not exists public.profiles (
  id           text primary key,                 -- 'maya', 'jordan', 'sam', 'bedside-room-8'
  name         text not null,
  role         text not null check (role in ('nurse', 'patient_device')),
  pod_id       text,
  room         text,
  auth_user_id uuid unique references auth.users (id) on delete set null
);

create table if not exists public.voice_clips (
  id         bigint generated always as identity primary key,
  actor_id   text not null,                      -- 'pod:pod-a', 'patient:room-8'
  who        text not null,                      -- 'maya', 'bedside-room-8'
  audio_url  text,
  transcript text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  sim_time   text,                               -- story time, e.g. '23:30'
  "from"     text not null,                      -- 'twin-room-6'
  "to"       text not null,                      -- 'nurse-pod-a'
  type       text not null,                      -- 'alert', 'note.new', ...
  text       text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at on public.audit_log (created_at desc);
create index if not exists voice_clips_actor on public.voice_clips (actor_id, created_at desc);

-- The voice service writes with the service-role key (bypasses RLS).
-- Signed-in staff can read, so the record is searchable from the dashboard or a client.
alter table public.profiles    enable row level security;
alter table public.voice_clips enable row level security;
alter table public.audit_log   enable row level security;

drop policy if exists "staff read profiles" on public.profiles;
create policy "staff read profiles" on public.profiles for select to authenticated using (true);
drop policy if exists "staff read voice clips" on public.voice_clips;
create policy "staff read voice clips" on public.voice_clips for select to authenticated using (true);
drop policy if exists "staff read audit log" on public.audit_log;
create policy "staff read audit log" on public.audit_log for select to authenticated using (true);

-- Audio bucket for voice clips and generated speech. Public so screens can play URLs directly.
-- Demo data only; no real patient audio.
insert into storage.buckets (id, name, public)
values ('voice', 'voice', true)
on conflict (id) do nothing;

-- Seed accounts: 3 nurses + one bedside device per room. Auth users are created by `npm run seed:auth`.
insert into public.profiles (id, name, role, pod_id, room) values
  ('maya',           'Maya',          'nurse',          'pod-a', null),
  ('jordan',         'Jordan',        'nurse',          'pod-a', null),
  ('sam',            'Sam',           'nurse',          'pod-b', null),
  ('bedside-room-2', 'Bedside Room 2', 'patient_device', 'pod-a', 'room-2'),
  ('bedside-room-4', 'Bedside Room 4', 'patient_device', 'pod-a', 'room-4'),
  ('bedside-room-6', 'Bedside Room 6', 'patient_device', 'pod-a', 'room-6'),
  ('bedside-room-8', 'Bedside Room 8', 'patient_device', 'pod-a', 'room-8'),
  ('bedside-room-3', 'Bedside Room 3', 'patient_device', 'pod-b', 'room-3')
on conflict (id) do update set name = excluded.name, role = excluded.role, pod_id = excluded.pod_id, room = excluded.room;
