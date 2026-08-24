-- GÊNES TECHNOLOGY - ÁUDIO NA ABERTURA DE CHAMADO
-- Permite gravar um áudio explicando o chamado; o áudio é salvo como anexo
-- (task_attachments, mime audio/*) e a transcrição fica em tasks.audio_transcript.

alter table public.tasks add column if not exists audio_transcript text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chamado-audios', 'chamado-audios', true, 15728640, array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
