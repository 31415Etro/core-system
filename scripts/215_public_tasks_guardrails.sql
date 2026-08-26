-- GÊNES TECHNOLOGY - GUARDA-CHUVAS NA ABERTURA PÚBLICA DE CHAMADO
-- 1) Manutenção só pode ser aberta com confirmação explícita de que é
--    queda/indisponibilidade do banco de dados ou sistema (evita gente
--    abrindo "manutenção" só para ser atendido mais rápido).
-- 2) Hash de cada foto anexada, para impedir reenvio da mesma imagem em
--    chamados diferentes.

alter table public.tasks add column if not exists outage_confirmed boolean;

alter table public.tasks drop constraint if exists tasks_outage_confirmed_required;
alter table public.tasks add constraint tasks_outage_confirmed_required
  check (request_type <> 'manutencao' or outage_confirmed = true);

alter table public.task_attachments add column if not exists content_hash text;

create index if not exists task_attachments_content_hash_idx
  on public.task_attachments (content_hash) where content_hash is not null;
