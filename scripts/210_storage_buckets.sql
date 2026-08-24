-- GÊNES TECHNOLOGY - BUCKETS DE STORAGE
-- chamado-fotos: público (fotos anexadas na abertura de chamado, exibidas direto no Kanban).
-- contratos-clientes: privado (PDF do contrato, só acessível via signed URL gerada por rota autenticada).
-- Todo upload/leitura passa pelas rotas de API usando createAdminClient() (service role),
-- por isso não há policies de storage.objects para "anon"/"authenticated" abaixo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chamado-fotos', 'chamado-fotos', true, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contratos-clientes', 'contratos-clientes', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
