-- GÊNES TECHNOLOGY - APRESENTAÇÕES DO CLIENTE (BOAS-VINDAS E CRONOGRAMA)
-- Mesma lógica do contrato: PDF privado no bucket "contratos-clientes",
-- acessado só via signed URL. Sobe o limite do bucket porque essas
-- apresentações costumam ter muitas páginas e pesar mais que um contrato.

alter table public.client_financials add column if not exists welcome_presentation_file_name text;
alter table public.client_financials add column if not exists welcome_presentation_storage_path text;
alter table public.client_financials add column if not exists welcome_presentation_uploaded_at timestamptz;

alter table public.client_financials add column if not exists schedule_presentation_file_name text;
alter table public.client_financials add column if not exists schedule_presentation_storage_path text;
alter table public.client_financials add column if not exists schedule_presentation_uploaded_at timestamptz;

update storage.buckets set file_size_limit = 52428800 where id = 'contratos-clientes';
