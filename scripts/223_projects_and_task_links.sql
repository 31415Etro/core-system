-- CORE · Projetos (por cliente) e vínculo de tarefas com cliente + projeto
-- Idempotente.

-- 1) Projetos: cada projeto pertence a um cliente
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'em_andamento' check (status in ('planejamento', 'em_andamento', 'pausado', 'concluido')),
  start_date date,
  due_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_client_idx on public.projects (client_id);
create unique index if not exists projects_client_name_uniq on public.projects (client_id, lower(name));

alter table public.projects enable row level security;
drop policy if exists "authenticated projects" on public.projects;
create policy "authenticated projects" on public.projects for all to authenticated using (true) with check (true);

-- 2) Tarefas: vínculo com projeto
alter table public.tasks add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists tasks_project_idx on public.tasks (project_id);
create index if not exists tasks_client_idx on public.tasks (client_id);

-- 3) Tarefas internas podem ter cliente (antes a regra exigia client_id vazio para kind = 'tarefa').
--    Continuam proibidos só os campos exclusivos de chamado.
alter table public.tasks drop constraint if exists tasks_tarefa_sem_campos_chamado;
alter table public.tasks add constraint tasks_tarefa_sem_campos_chamado check (
  kind <> 'tarefa' or (request_type is null and cost_acknowledged is null)
);
