-- GÊNES TECHNOLOGY - KANBAN UNIFICADO DE TAREFAS INTERNAS E CHAMADOS EXTERNOS
-- Substitui o modelo antigo de support_tickets/ticket_attachments/credit_ledger da Waycore.

create sequence if not exists public.os_number_seq start with 1 increment by 1;

create or replace function public.next_os_number()
returns text language sql as $$
  select 'OS-' || lpad(nextval('public.os_number_seq')::text, 4, '0');
$$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('tarefa','chamado')),
  os_number text unique,
  source text not null default 'interno' check (source in ('interno','publico')),
  client_id uuid references public.clients(id) on delete set null,
  company_name text,
  requester_name text,
  request_type text check (request_type in ('nova_funcionalidade','manutencao','nova_pagina')),
  cost_acknowledged boolean,
  estimated_window text,
  title text not null,
  description text not null,
  priority text not null default 'media' check (priority in ('baixa','media','alta')),
  status text not null default 'a_fazer' check (status in ('triagem','a_fazer','em_andamento','aguardando_cliente','concluido')),
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_chamado_requires_fields check (
    kind <> 'chamado' or (requester_name is not null and company_name is not null and request_type is not null)
  ),
  constraint tasks_tarefa_sem_campos_chamado check (
    kind <> 'tarefa' or (request_type is null and cost_acknowledged is null and client_id is null)
  ),
  constraint tasks_cost_ack_so_para_feature check (
    request_type is distinct from 'nova_funcionalidade' or cost_acknowledged is not null
  ),
  constraint tasks_cost_ack_apenas_feature check (
    request_type = 'nova_funcionalidade' or cost_acknowledged is null
  )
);

-- kind='chamado' + request_type='manutencao' nasce (e permanece) com prioridade alta, garantido no banco.
-- OS number sequencial e atômico (nextval), só atribuído a chamados.
create or replace function public.tasks_before_insert()
returns trigger language plpgsql as $$
begin
  if new.kind = 'chamado' and new.os_number is null then
    new.os_number := public.next_os_number();
  end if;
  if new.kind = 'chamado' and new.request_type = 'manutencao' then
    new.priority := 'alta';
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_before_insert on public.tasks;
create trigger tasks_before_insert before insert on public.tasks
  for each row execute function public.tasks_before_insert();

create or replace function public.tasks_before_update()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status = 'concluido' and old.status <> 'concluido' then
    new.completed_at = now();
  elsif new.status <> 'concluido' then
    new.completed_at = null;
  end if;
  if new.kind = 'chamado' and new.request_type = 'manutencao' then
    new.priority := 'alta';
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_before_update on public.tasks;
create trigger tasks_before_update before update on public.tasks
  for each row execute function public.tasks_before_update();

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_name text not null, storage_path text not null, public_url text,
  mime_type text, file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  created_at timestamptz not null default now()
);

create index if not exists tasks_kanban_idx on public.tasks (status, priority, created_at desc);
create index if not exists tasks_client_idx on public.tasks (client_id, created_at desc);
create index if not exists tasks_os_number_idx on public.tasks (os_number);
create index if not exists task_attachments_task_idx on public.task_attachments (task_id, created_at asc);

alter table public.tasks enable row level security;
alter table public.task_attachments enable row level security;
drop policy if exists "authenticated tasks" on public.tasks;
create policy "authenticated tasks" on public.tasks for all to authenticated using (true) with check (true);
drop policy if exists "authenticated task_attachments" on public.task_attachments;
create policy "authenticated task_attachments" on public.task_attachments for all to authenticated using (true) with check (true);
-- Sem policy para "anon": a rota pública de abertura de chamado grava sempre via
-- createAdminClient() (service role), que ignora RLS. A anon key nunca lê/escreve aqui direto.
