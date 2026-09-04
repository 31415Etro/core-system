-- GÊNES TECHNOLOGY - LIMITE DE ABUSO NA CONSULTA PÚBLICA DE ACOMPANHAMENTO DE CHAMADOS
-- Mesma lógica do public_submission_log (211), mas em tabela própria porque é uma ação
-- diferente (consulta, não abertura de chamado) e não deve competir pelo mesmo limite.

create table if not exists public.public_search_log (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  created_at timestamptz not null default now()
);

create index if not exists public_search_log_ip_idx on public.public_search_log (ip, created_at desc);

alter table public.public_search_log enable row level security;
