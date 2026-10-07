-- CORE · Vídeo das reuniões (gravação da aba do Google Meet pela extensão CORE Meet)
-- Idempotente. O vídeo é gravado em partes de ~5 min (track = 'video') junto com as faixas de áudio
-- ('mic' e 'tab', usadas na transcrição). Os arquivos de vídeo ficam no bucket privado reunioes-video.

alter table public.meeting_audio_parts drop constraint if exists meeting_audio_parts_track_check;
alter table public.meeting_audio_parts add constraint meeting_audio_parts_track_check check (track in ('mic', 'tab', 'video'));

alter table public.meetings add column if not exists video_bytes bigint;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reunioes-video', 'reunioes-video', false, 209715200, array['video/webm', 'video/mp4'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
