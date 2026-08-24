-- WAYCORE T.I. - cobranças pré-programadas (assinaturas recorrentes via ASAAS)
create table if not exists public.asaas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  asaas_customer_id text not null,
  asaas_subscription_id text not null unique,
  billing_type text not null check (billing_type in ('BOLETO','PIX','CREDIT_CARD')),
  value numeric(12,2) not null,
  cycle text not null check (cycle in ('WEEKLY','BIWEEKLY','MONTHLY','BIMONTHLY','QUARTERLY','SEMIANNUALLY','YEARLY')),
  next_due_date date not null,
  end_date date,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','CANCELLED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists asaas_subscriptions_client_idx on public.asaas_subscriptions(client_id);

drop trigger if exists asaas_subscriptions_updated_at on public.asaas_subscriptions;
create trigger asaas_subscriptions_updated_at before update on public.asaas_subscriptions for each row execute function public.set_updated_at();

alter table public.asaas_subscriptions enable row level security;
drop policy if exists "authenticated asaas_subscriptions" on public.asaas_subscriptions;
create policy "authenticated asaas_subscriptions" on public.asaas_subscriptions for all to authenticated using (true) with check (true);
