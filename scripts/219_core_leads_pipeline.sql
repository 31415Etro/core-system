-- CORE · Leads (pipeline, lista, prospecção, atividades)
-- Estende commercial_opportunities (que passa a ser o "lead" da CORE) sem apagar dados.
-- Idempotente: pode ser executado mais de uma vez.

-- 1) Novos campos do lead
alter table public.commercial_opportunities add column if not exists whatsapp text;
alter table public.commercial_opportunities add column if not exists segment text;
alter table public.commercial_opportunities add column if not exists source text;
alter table public.commercial_opportunities add column if not exists city text;
alter table public.commercial_opportunities add column if not exists logo_url text;
alter table public.commercial_opportunities add column if not exists next_action text;
alter table public.commercial_opportunities add column if not exists lost_reason text;
alter table public.commercial_opportunities add column if not exists stage_changed_at timestamptz;
alter table public.commercial_opportunities add column if not exists last_activity_at timestamptz;
alter table public.commercial_opportunities add column if not exists archived_at timestamptz;
alter table public.commercial_opportunities add column if not exists prospect_status text;

-- Venda registrada no próprio lead ao fechar o negócio (não existe página "Vendas")
alter table public.commercial_opportunities add column if not exists closed_at date;
alter table public.commercial_opportunities add column if not exists closed_value numeric(12,2);
alter table public.commercial_opportunities add column if not exists monthly_value numeric(12,2);

update public.commercial_opportunities
   set stage_changed_at = coalesce(updated_at, created_at)
 where stage_changed_at is null;

alter table public.commercial_opportunities alter column stage_changed_at set default now();
alter table public.commercial_opportunities alter column stage_changed_at set not null;

alter table public.commercial_opportunities drop constraint if exists commercial_opportunities_prospect_status_check;
alter table public.commercial_opportunities add constraint commercial_opportunities_prospect_status_check check (
  prospect_status is null or prospect_status in ('primeiro_contato', 'follow_up', 'respondido', 'sem_resposta', 'qualificado', 'descartado')
);

-- 2) Etapas do pipeline CORE (11). Converte as etapas antigas.
alter table public.commercial_opportunities drop constraint if exists commercial_opportunities_stage_check;

update public.commercial_opportunities
   set stage = case stage
     when 'prospeccao'       then 'novo_lead'
     when 'qualificacao'     then 'qualificado'
     when 'ganho'            then 'fechado'
     when 'proposta_enviada' then 'proposta'
     when 'contato'          then 'contato_realizado'
     when 'reuniao'          then 'reuniao_agendada'
     when 'venda'            then 'fechado'
     when 'onboarding'       then 'fechado'
     when 'cliente_ativo'    then 'fechado'
     else stage
   end
 where stage in ('prospeccao', 'qualificacao', 'ganho', 'proposta_enviada', 'contato', 'reuniao', 'venda', 'onboarding', 'cliente_ativo');

alter table public.commercial_opportunities alter column stage set default 'novo_lead';
alter table public.commercial_opportunities add constraint commercial_opportunities_stage_check check (stage in (
  'novo_lead', 'contato_realizado', 'reuniao_agendada', 'reuniao_realizada', 'qualificado', 'demo',
  'proposta', 'negociacao', 'contrato', 'fechado', 'perdido'
));

create index if not exists commercial_opportunities_stage_idx on public.commercial_opportunities (stage);
create index if not exists commercial_opportunities_assigned_idx on public.commercial_opportunities (assigned_to);

-- 3) "Dias na etapa": atualiza stage_changed_at sempre que a etapa muda
create or replace function public.set_stage_changed_at()
returns trigger language plpgsql as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_changed_at = now();
  end if;
  return new;
end $$;

drop trigger if exists commercial_opportunities_stage_changed on public.commercial_opportunities;
create trigger commercial_opportunities_stage_changed
  before update on public.commercial_opportunities
  for each row execute function public.set_stage_changed_at();

-- 4) Atividades e histórico do lead
create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.commercial_opportunities(id) on delete cascade,
  kind text not null,
  description text,
  from_stage text,
  to_stage text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.lead_activities drop constraint if exists lead_activities_kind_check;
alter table public.lead_activities add constraint lead_activities_kind_check
  check (kind in ('created', 'stage_change', 'update', 'note', 'call', 'email', 'whatsapp', 'meeting', 'sale'));

create index if not exists lead_activities_opportunity_idx on public.lead_activities (opportunity_id, created_at desc);
create index if not exists lead_activities_created_idx on public.lead_activities (created_at desc);

alter table public.lead_activities enable row level security;
drop policy if exists "authenticated lead_activities" on public.lead_activities;
create policy "authenticated lead_activities" on public.lead_activities for all to authenticated using (true) with check (true);

-- 5) "Última atividade" do lead mantida pelo banco
create or replace function public.touch_lead_last_activity()
returns trigger language plpgsql as $$
begin
  update public.commercial_opportunities set last_activity_at = new.created_at where id = new.opportunity_id;
  return new;
end $$;

drop trigger if exists lead_activities_touch_lead on public.lead_activities;
create trigger lead_activities_touch_lead
  after insert on public.lead_activities
  for each row execute function public.touch_lead_last_activity();

update public.commercial_opportunities o
   set last_activity_at = a.last_at
  from (select opportunity_id, max(created_at) as last_at from public.lead_activities group by opportunity_id) a
 where a.opportunity_id = o.id and o.last_activity_at is null;
