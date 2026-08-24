-- GÊNES TECHNOLOGY - SCHEMA BASE PARA SUPABASE
-- Pode ser executado em um projeto Supabase vazio. Continua em 208 (tarefas/chamados) e 209 (financeiro do cliente).

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role text not null default 'user' check (role in ('admin','manager','support','finance','commercial','client','user')),
  active boolean not null default true,
  page_permissions text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null, legal_name text, document text unique, email text, phone text,
  contact_name text, contact_phone text, contact_email text,
  status text not null default 'active' check (status in ('active','inactive','prospect')),
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null, legal_name text, document text unique, email text, phone text,
  contact_name text, category text, status text not null default 'active' check (status in ('active','inactive')),
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.support_contracts (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete cascade,
  plan_name text not null, plan_type text not null default 'credits' check (plan_type in ('credits','unlimited','server','email')),
  monthly_credits integer check (monthly_credits is null or monthly_credits >= 0), unlimited boolean not null default false,
  monthly_value numeric(12,2) not null default 0 check (monthly_value >= 0),
  due_day integer check (due_day between 1 and 31), payment_method text,
  scope_notes text, active boolean not null default true,
  starts_at date not null default current_date, ends_at date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id), supplier_id uuid references public.suppliers(id),
  type text not null check (type in ('income','expense')), description text not null,
  amount numeric(12,2) not null check (amount >= 0), transaction_date date not null,
  due_date date, paid_at timestamptz, status text not null default 'pending' check (status in ('pending','paid','overdue','cancelled')),
  account_name text, category text, external_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(), account_name text not null,
  direction text not null check (direction in ('entrada','saida')), file_name text not null, storage_path text,
  imported_rows integer not null default 0,
  status text not null default 'processando' check (status in ('processando','concluido','erro')),
  error_message text, created_at timestamptz not null default now()
);

create table if not exists public.commercial_opportunities (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id),
  company_name text not null, contact_name text, email text, phone text,
  stage text not null default 'prospeccao' check (stage in ('prospeccao','qualificacao','proposta','negociacao','ganho','perdido')),
  estimated_value numeric(12,2) not null default 0, assigned_to uuid references public.profiles(id),
  notes text, next_action_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists financial_transactions_date_idx on public.financial_transactions (transaction_date desc);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
drop trigger if exists suppliers_updated_at on public.suppliers;
create trigger suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
drop trigger if exists support_contracts_updated_at on public.support_contracts;
create trigger support_contracts_updated_at before update on public.support_contracts for each row execute function public.set_updated_at();
drop trigger if exists financial_transactions_updated_at on public.financial_transactions;
create trigger financial_transactions_updated_at before update on public.financial_transactions for each row execute function public.set_updated_at();
drop trigger if exists commercial_opportunities_updated_at on public.commercial_opportunities;
create trigger commercial_opportunities_updated_at before update on public.commercial_opportunities for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.suppliers enable row level security;
alter table public.support_contracts enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.bank_statement_imports enable row level security;
alter table public.commercial_opportunities enable row level security;

drop policy if exists "authenticated profiles" on public.profiles;
create policy "authenticated profiles" on public.profiles for all to authenticated using (true) with check (true);
drop policy if exists "authenticated clients" on public.clients;
create policy "authenticated clients" on public.clients for all to authenticated using (true) with check (true);
drop policy if exists "authenticated suppliers" on public.suppliers;
create policy "authenticated suppliers" on public.suppliers for all to authenticated using (true) with check (true);
drop policy if exists "authenticated support_contracts" on public.support_contracts;
create policy "authenticated support_contracts" on public.support_contracts for all to authenticated using (true) with check (true);
drop policy if exists "authenticated financial_transactions" on public.financial_transactions;
create policy "authenticated financial_transactions" on public.financial_transactions for all to authenticated using (true) with check (true);
drop policy if exists "authenticated statement_imports" on public.bank_statement_imports;
create policy "authenticated statement_imports" on public.bank_statement_imports for all to authenticated using (true) with check (true);
drop policy if exists "authenticated commercial_opportunities" on public.commercial_opportunities;
create policy "authenticated commercial_opportunities" on public.commercial_opportunities for all to authenticated using (true) with check (true);
