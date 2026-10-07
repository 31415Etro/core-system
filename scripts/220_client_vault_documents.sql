-- CORE · Clientes: cofre de senhas + contratos e documentos
-- Idempotente. Inclui o cofre do script 203 (se ele já foi aplicado, nada é perdido) e acrescenta:
--   * edição, troca de senha e desativação de credenciais;
--   * mais tipos de acesso;
--   * tabela de documentos (vários PDFs por cliente) no bucket privado "contratos-clientes".
-- Senhas ficam criptografadas no Supabase Vault: a tabela guarda só o id do segredo.

create extension if not exists supabase_vault with schema vault;

-- 1) Cofre (mesma estrutura do 203)
create table if not exists public.client_credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  vault_secret_id uuid not null unique,
  access_type text not null,
  label text not null,
  username text not null,
  host text,
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credential_access_log (
  id bigint generated always as identity primary key,
  credential_id uuid not null references public.client_credentials(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null check (action in ('create', 'reveal', 'update', 'deactivate')),
  occurred_at timestamptz not null default now()
);

-- Tipos de acesso ampliados
alter table public.client_credentials drop constraint if exists client_credentials_access_type_check;
alter table public.client_credentials add constraint client_credentials_access_type_check
  check (access_type in ('computer', 'server', 'network', 'email', 'system', 'website', 'database', 'vpn', 'cloud', 'other'));

create index if not exists client_credentials_client_idx on public.client_credentials (client_id, active, access_type);
create index if not exists credential_access_log_idx on public.credential_access_log (credential_id, occurred_at desc);

drop trigger if exists client_credentials_updated_at on public.client_credentials;
create trigger client_credentials_updated_at before update on public.client_credentials
  for each row execute function public.set_updated_at();

-- Quem pode usar o cofre: admin, gestor e suporte ativos
create or replace function public.can_manage_client_credentials() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role in ('admin', 'manager', 'support'));
$$;

create or replace function public.create_client_credential(
  p_client_id uuid, p_access_type text, p_label text, p_username text, p_secret text, p_host text default null, p_notes text default null
) returns uuid language plpgsql security definer set search_path = public, vault as $$
declare v_vault_id uuid; v_id uuid;
begin
  if not public.can_manage_client_credentials() then raise exception 'Acesso negado'; end if;
  if length(coalesce(p_secret, '')) < 4 then raise exception 'Senha inválida'; end if;
  select vault.create_secret(p_secret, 'core_' || gen_random_uuid()::text, 'Credencial de cliente CORE') into v_vault_id;
  insert into public.client_credentials (client_id, vault_secret_id, access_type, label, username, host, notes, created_by, updated_by)
  values (p_client_id, v_vault_id, p_access_type, p_label, p_username, p_host, p_notes, auth.uid(), auth.uid())
  returning id into v_id;
  insert into public.credential_access_log (credential_id, actor_id, action) values (v_id, auth.uid(), 'create');
  return v_id;
end $$;

create or replace function public.reveal_client_credential(p_credential_id uuid) returns text
language plpgsql security definer set search_path = public, vault as $$
declare v_secret text;
begin
  if not public.can_manage_client_credentials() then raise exception 'Acesso negado'; end if;
  select ds.decrypted_secret into v_secret
    from public.client_credentials c join vault.decrypted_secrets ds on ds.id = c.vault_secret_id
   where c.id = p_credential_id and c.active;
  if v_secret is null then raise exception 'Credencial não encontrada'; end if;
  insert into public.credential_access_log (credential_id, actor_id, action) values (p_credential_id, auth.uid(), 'reveal');
  return v_secret;
end $$;

-- Novo: editar dados e, opcionalmente, trocar a senha (p_secret nulo = mantém a atual)
create or replace function public.update_client_credential(
  p_credential_id uuid, p_access_type text, p_label text, p_username text, p_host text default null, p_notes text default null, p_secret text default null
) returns void language plpgsql security definer set search_path = public, vault as $$
declare v_vault_id uuid;
begin
  if not public.can_manage_client_credentials() then raise exception 'Acesso negado'; end if;
  select vault_secret_id into v_vault_id from public.client_credentials where id = p_credential_id and active;
  if v_vault_id is null then raise exception 'Credencial não encontrada'; end if;
  if p_secret is not null and length(p_secret) > 0 then
    if length(p_secret) < 4 then raise exception 'Senha inválida'; end if;
    perform vault.update_secret(v_vault_id, p_secret);
  end if;
  update public.client_credentials
     set access_type = p_access_type, label = p_label, username = p_username, host = p_host, notes = p_notes, updated_by = auth.uid()
   where id = p_credential_id;
  insert into public.credential_access_log (credential_id, actor_id, action) values (p_credential_id, auth.uid(), 'update');
end $$;

-- Novo: desativar (o segredo deixa de ser revelável; histórico é mantido)
create or replace function public.deactivate_client_credential(p_credential_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_client_credentials() then raise exception 'Acesso negado'; end if;
  update public.client_credentials set active = false, updated_by = auth.uid() where id = p_credential_id and active;
  if not found then raise exception 'Credencial não encontrada'; end if;
  insert into public.credential_access_log (credential_id, actor_id, action) values (p_credential_id, auth.uid(), 'deactivate');
end $$;

alter table public.client_credentials enable row level security;
alter table public.credential_access_log enable row level security;
drop policy if exists "credential metadata authorized" on public.client_credentials;
create policy "credential metadata authorized" on public.client_credentials for select to authenticated using (public.can_manage_client_credentials());
drop policy if exists "credential audit admins" on public.credential_access_log;
create policy "credential audit admins" on public.credential_access_log for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and active and role in ('admin', 'manager')));

revoke all on public.client_credentials from anon;
revoke all on public.credential_access_log from anon;
grant select on public.client_credentials to authenticated;
grant select on public.credential_access_log to authenticated;

revoke all on function public.create_client_credential(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.reveal_client_credential(uuid) from public, anon;
revoke all on function public.update_client_credential(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.deactivate_client_credential(uuid) from public, anon;
grant execute on function public.create_client_credential(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.reveal_client_credential(uuid) to authenticated;
grant execute on function public.update_client_credential(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.deactivate_client_credential(uuid) to authenticated;

-- 2) Contratos e documentos do cliente (PDFs no bucket privado "contratos-clientes")
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contratos-clientes', 'contratos-clientes', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, allowed_mime_types = excluded.allowed_mime_types,
  file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), excluded.file_size_limit);

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  category text not null default 'contrato' check (category in ('contrato', 'aditivo', 'proposta', 'nota_fiscal', 'documento', 'outro')),
  title text not null,
  file_name text not null,
  storage_path text not null unique,
  file_size_bytes bigint,
  signed_at date,
  notes text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists client_documents_client_idx on public.client_documents (client_id, created_at desc);

alter table public.client_documents enable row level security;
drop policy if exists "authenticated client_documents" on public.client_documents;
create policy "authenticated client_documents" on public.client_documents for all to authenticated using (true) with check (true);
