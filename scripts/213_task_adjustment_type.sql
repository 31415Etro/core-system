-- GÊNES TECHNOLOGY - TIPO DE CHAMADO "AJUSTE"
-- Ajuste: alteração pontual em uma página existente. Exige ciência de custo
-- adicional (como "nova funcionalidade") e a página a ser ajustada.
-- Se o projeto está em desenvolvimento, o cliente tem direito a até 3
-- ajustes por página sem custo (aviso mostrado na abertura do chamado).

alter table public.tasks add column if not exists adjustment_page text;
alter table public.tasks add column if not exists in_development boolean not null default false;

alter table public.tasks drop constraint if exists tasks_request_type_check;
alter table public.tasks add constraint tasks_request_type_check
  check (request_type in ('nova_funcionalidade','manutencao','nova_pagina','ajuste'));

alter table public.tasks drop constraint if exists tasks_cost_ack_apenas_feature;
alter table public.tasks add constraint tasks_cost_ack_apenas_feature
  check (request_type in ('nova_funcionalidade','ajuste') or cost_acknowledged is null);

alter table public.tasks drop constraint if exists tasks_cost_ack_so_para_feature;
alter table public.tasks add constraint tasks_cost_ack_so_para_feature
  check (request_type not in ('nova_funcionalidade','ajuste') or cost_acknowledged is not null);

alter table public.tasks drop constraint if exists tasks_adjustment_page_required;
alter table public.tasks add constraint tasks_adjustment_page_required
  check (request_type <> 'ajuste' or adjustment_page is not null);

alter table public.tasks drop constraint if exists tasks_adjustment_page_only_for_ajuste;
alter table public.tasks add constraint tasks_adjustment_page_only_for_ajuste
  check (request_type = 'ajuste' or adjustment_page is null);
