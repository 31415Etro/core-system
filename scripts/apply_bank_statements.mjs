// Aplica o dump gerado por prepare_real_data_import.py (scripts/201_import_real_data.json) direto no Supabase.
// Uso: node --env-file=.env.local scripts/apply_bank_statements.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados")
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const dump = JSON.parse(fs.readFileSync(path.join(__dirname, "201_import_real_data.json"), "utf8"))

async function run() {
  console.log(`[apply] ${dump.subscriptions.length} clientes/contratos, ${dump.transactions.length} transações`)

  for (const s of dump.subscriptions) {
    const scopeNotes = [s.scope, s.ticket_types ? `Tipos: ${s.ticket_types}` : "", s.notes].filter(Boolean).join(" | ")
    const { error: clientError } = await supabase.from("clients").upsert({
      id: s.client_id, name: s.name, legal_name: s.legal_name, document: s.document, status: "active", notes: s.notes,
    }, { onConflict: "id" })
    if (clientError) throw clientError

    const { error: contractError } = await supabase.from("support_contracts").upsert({
      id: s.contract_id, client_id: s.client_id, plan_name: s.plan, plan_type: s.plan_type,
      monthly_credits: s.credits, unlimited: s.unlimited, monthly_value: s.monthly, due_day: s.due_day,
      payment_method: s.payment, scope_notes: scopeNotes, active: true,
    }, { onConflict: "id" })
    if (contractError) throw contractError
  }
  console.log("[apply] clientes/contratos ok")

  const BATCH = 500
  for (let i = 0; i < dump.transactions.length; i += BATCH) {
    const batch = dump.transactions.slice(i, i + BATCH).map(t => ({
      id: t.id, client_id: t.client_id, type: t.type, description: t.description, amount: t.amount,
      transaction_date: t.date, paid_at: `${t.date} 12:00:00+00`, status: "paid",
      account_name: t.account, category: t.category, external_id: t.external_id,
    }))
    const { error } = await supabase.from("financial_transactions").upsert(batch, { onConflict: "id" })
    if (error) throw error
    console.log(`[apply] transações ${Math.min(i + BATCH, dump.transactions.length)}/${dump.transactions.length}`)
  }

  const allFiles = [
    ...dump.ailos_files.map(([name, count]) => ({ name, account: "AILOS", direction: "saida", count })),
    ...dump.asaas_files.map(([name, count]) => ({ name, account: "ASAAS", direction: "entrada", count })),
  ]
  const fileNames = allFiles.map(f => f.name)
  const { error: delError } = await supabase.from("bank_statement_imports").delete().in("file_name", fileNames)
  if (delError) throw delError
  const { error: importError } = await supabase.from("bank_statement_imports").insert(
    allFiles.map(f => ({ account_name: f.account, direction: f.direction, file_name: f.name, imported_rows: f.count, status: "concluido" })),
  )
  if (importError) throw importError
  console.log("[apply] bank_statement_imports ok:", allFiles)

  console.log("[apply] concluído")
}

run().catch(error => { console.error("[apply] ERRO:", error); process.exit(1) })
