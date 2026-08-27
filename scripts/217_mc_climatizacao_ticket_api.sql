-- GÊNES TECHNOLOGY - CHAVE DE API PARA O SISTEMA DA MC CLIMATIZAÇÃO
-- Permite que o sistema da MC Climatização abra chamados de "Ajuste" diretamente
-- via API (POST /api/integrations/mc-climatizacao/tickets, header x-api-key),
-- sem passar por formulário. Chave própria, independente da do agente de IA.

alter table public.integration_settings add column if not exists mc_climatizacao_ticket_api_key text;
