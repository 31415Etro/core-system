-- WAYCORE T.I. - integração ASAAS (cobranças, boletos, sincronização de clientes)
alter table public.clients add column if not exists asaas_customer_id text unique;

create table if not exists public.asaas_charges (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  asaas_customer_id text not null,
  asaas_payment_id text not null unique,
  billing_type text not null check (billing_type in ('BOLETO','PIX','CREDIT_CARD','UNDEFINED')),
  value numeric(12,2) not null,
  net_value numeric(12,2),
  due_date date not null,
  description text,
  status text not null default 'PENDING',
  invoice_url text, bank_slip_url text, pix_qr_code_id text,
  external_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists asaas_charges_client_idx on public.asaas_charges(client_id);
create index if not exists asaas_charges_status_idx on public.asaas_charges(status, due_date);

drop trigger if exists asaas_charges_updated_at on public.asaas_charges;
create trigger asaas_charges_updated_at before update on public.asaas_charges for each row execute function public.set_updated_at();

alter table public.asaas_charges enable row level security;
drop policy if exists "authenticated asaas_charges" on public.asaas_charges;
create policy "authenticated asaas_charges" on public.asaas_charges for all to authenticated using (true) with check (true);
