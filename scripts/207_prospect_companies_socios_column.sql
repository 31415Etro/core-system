-- Corrige: o CREATE TABLE IF NOT EXISTS do 204 não adiciona coluna nova a tabela já existente.
alter table public.prospect_companies add column if not exists socios text[] not null default '{}';
