# Gênes Group

Sistema interno de gestão da Gênes Technology.

## Módulos

- Visão geral da operação
- Clientes, fornecedores e financeiro do projeto (valores, parcelas, manutenção, contrato)
- Kanban de tarefas internas e chamados (com abertura pública de chamado)
- Financeiro e conciliação
- Funil comercial

## Desenvolvimento local

```bash
npm install --ignore-scripts
node ./node_modules/next/dist/bin/next dev
```

Acesse `http://localhost:3000`.

## Supabase

Configure em `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Rode os scripts de `scripts/` na ordem: `200 → 203 → 204 → 205 → 206 → 207 → 208 → 209 → 210 → 211`, depois `node --env-file=.env.local scripts/create_admin_user.mjs`.
