-- WAYCORE T.I. - empresas prospectadas via CNAE/UF (Receita Federal)
create table if not exists public.prospect_companies (
  id uuid primary key default gen_random_uuid(),
  cnpj text not null unique,
  company_name text not null,
  trade_name text,
  cnae_principal text not null,
  situacao_cadastral text not null,
  logradouro text, numero text, complemento text, bairro text,
  cep text, municipio text, uf text not null,
  telefone text, email text,
  socios text[] not null default '{}',
  latitude numeric(9,6), longitude numeric(9,6),
  geocode_source text,
  linked_opportunity_id uuid references public.commercial_opportunities(id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists prospect_companies_cnae_idx on public.prospect_companies(cnae_principal);
create index if not exists prospect_companies_uf_idx on public.prospect_companies(uf);

drop trigger if exists prospect_companies_updated_at on public.prospect_companies;
create trigger prospect_companies_updated_at before update on public.prospect_companies for each row execute function public.set_updated_at();

alter table public.prospect_companies enable row level security;
drop policy if exists "authenticated prospect_companies" on public.prospect_companies;
create policy "authenticated prospect_companies" on public.prospect_companies for all to authenticated using (true) with check (true);

-- Campos extras no pipeline comercial para poder cadastrar/editar CNPJ e sócios direto no kanban.
alter table public.commercial_opportunities add column if not exists cnpj text;
alter table public.commercial_opportunities add column if not exists socios text[] not null default '{}';
