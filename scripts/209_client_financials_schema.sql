-- GÊNES TECHNOLOGY - FINANCEIRO DO PROJETO POR CLIENTE
-- Complementa public.clients / public.support_contracts com dados de venda do projeto:
-- valor total, parcelamento, manutenção contratada, pacote de alteração e contrato anexado.

create table if not exists public.client_financials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  project_total_value numeric(12,2),
  installments_total integer check (installments_total is null or installments_total >= 0),
  installments_paid integer check (installments_paid is null or installments_paid >= 0),
  has_maintenance boolean not null default false,
  maintenance_monthly_value numeric(12,2),
  has_change_package boolean not null default false,
  change_package_scope text,
  contract_file_name text,
  contract_storage_path text,
  contract_uploaded_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_financials_parcelas_coerentes check (
    installments_total is null or installments_paid is null or installments_paid <= installments_total
  )
);

drop trigger if exists client_financials_updated_at on public.client_financials;
create trigger client_financials_updated_at before update on public.client_financials
  for each row execute function public.set_updated_at();

create index if not exists client_financials_client_idx on public.client_financials (client_id);

alter table public.client_financials enable row level security;
drop policy if exists "authenticated client_financials" on public.client_financials;
create policy "authenticated client_financials" on public.client_financials for all to authenticated using (true) with check (true);
-- contract_storage_path aponta para o bucket privado "contratos-clientes" (ver 210):
-- a leitura é sempre via signed URL gerada sob demanda por uma rota autenticada, nunca URL pública.
