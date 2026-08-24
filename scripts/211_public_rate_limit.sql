-- GÊNES TECHNOLOGY - MITIGAÇÃO LEVE DE ABUSO NA ROTA PÚBLICA DE ABERTURA DE CHAMADO
-- Sem CAPTCHA nesta versão: essa tabela só serve para a API pública limitar
-- quantos chamados o mesmo IP pode abrir por hora. Sem policies: só a rota
-- pública (service role) lê/escreve aqui.

create table if not exists public.public_submission_log (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  created_at timestamptz not null default now()
);

create index if not exists public_submission_log_ip_idx on public.public_submission_log (ip, created_at desc);

alter table public.public_submission_log enable row level security;
