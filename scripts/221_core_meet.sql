-- CORE · Reuniões (extensão CORE Meet + IA)
-- Idempotente. Reuniões gravadas pela extensão do Chrome (seu microfone e o som do Meet em faixas separadas),
-- transcrição gratuita do áudio (Whisper), ata/tarefas/pendências pela IA e tokens de acesso da extensão.

-- 1) Reuniões
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('interna', 'cliente', 'lead')),
  title text not null,
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.commercial_opportunities(id) on delete set null,
  status text not null default 'gravando' check (status in ('gravando', 'processando', 'concluida', 'erro')),
  meet_url text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  participants text[] not null default '{}',
  audio_bytes bigint,
  transcript text,
  transcript_source text,
  summary text,
  minutes jsonb,
  next_meeting jsonb,
  next_steps text[] not null default '{}',
  lead_insights jsonb,
  ai_model text,
  input_tokens integer,
  output_tokens integer,
  error text,
  created_by uuid references public.profiles(id) on delete set null,
  extension_token_id uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists meetings_started_idx on public.meetings (started_at desc);
create index if not exists meetings_client_idx on public.meetings (client_id);
create index if not exists meetings_lead_idx on public.meetings (lead_id);

-- 2) Partes do áudio (gravadas em blocos de ~10 min, por faixa: mic = você, tab = participantes)
create table if not exists public.meeting_audio_parts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  track text not null check (track in ('mic', 'tab')),
  part_index integer not null,
  path text not null unique,
  start_offset_seconds numeric(10,2) not null default 0,
  duration_seconds numeric(10,2),
  bytes bigint,
  created_at timestamptz not null default now(),
  unique (meeting_id, track, part_index)
);
create index if not exists meeting_audio_parts_meeting_idx on public.meeting_audio_parts (meeting_id, part_index);

-- 3) Tarefas sugeridas pela IA (viram tarefas reais quando o usuário confirma)
alter table public.tasks add column if not exists meeting_id uuid;

create table if not exists public.meeting_tasks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  title text not null,
  description text,
  owner text,
  due_date date,
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta')),
  scope text not null default 'avulsa' check (scope in ('avulsa', 'projeto')),
  client_id uuid references public.clients(id) on delete set null,
  status text not null default 'sugerida' check (status in ('sugerida', 'criada', 'ignorada')),
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists meeting_tasks_meeting_idx on public.meeting_tasks (meeting_id);

alter table public.tasks drop constraint if exists tasks_meeting_id_fkey;
alter table public.tasks add constraint tasks_meeting_id_fkey foreign key (meeting_id) references public.meetings(id) on delete set null;

-- 4) Pendências (nossas x do cliente)
create table if not exists public.meeting_pending (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  side text not null check (side in ('nossa', 'cliente')),
  description text not null,
  owner text,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists meeting_pending_meeting_idx on public.meeting_pending (meeting_id);

-- 5) Tokens da extensão (guardados só como hash SHA-256)
create table if not exists public.extension_tokens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- 6) Áudio das reuniões (privado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reunioes-audio', 'reunioes-audio', false, 209715200, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 7) RLS (a extensão acessa só pelas rotas da API, com service role)
alter table public.meetings enable row level security;
alter table public.meeting_audio_parts enable row level security;
alter table public.meeting_tasks enable row level security;
alter table public.meeting_pending enable row level security;
alter table public.extension_tokens enable row level security;

drop policy if exists "authenticated meetings" on public.meetings;
create policy "authenticated meetings" on public.meetings for all to authenticated using (true) with check (true);
drop policy if exists "authenticated meeting_audio_parts" on public.meeting_audio_parts;
create policy "authenticated meeting_audio_parts" on public.meeting_audio_parts for all to authenticated using (true) with check (true);
drop policy if exists "authenticated meeting_tasks" on public.meeting_tasks;
create policy "authenticated meeting_tasks" on public.meeting_tasks for all to authenticated using (true) with check (true);
drop policy if exists "authenticated meeting_pending" on public.meeting_pending;
create policy "authenticated meeting_pending" on public.meeting_pending for all to authenticated using (true) with check (true);
-- extension_tokens: sem policy => inacessível a anon/authenticated; só a service role (API) lê e grava.
