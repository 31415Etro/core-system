-- GÊNES TECHNOLOGY - WEBHOOK DE CHAMADOS PARA AGENTE DE IA
-- Guarda a URL do webhook disparado a cada chamado novo e a chave que o
-- agente externo usa para chamar de volta a API e alterar o chamado.

create table if not exists public.integration_settings (
  id text primary key default 'default',
  chamado_webhook_url text,
  agent_api_key text,
  updated_at timestamptz not null default now()
);

alter table public.integration_settings enable row level security;

drop policy if exists "authenticated read integration settings" on public.integration_settings;
create policy "authenticated read integration settings" on public.integration_settings
  for select to authenticated using (true);
