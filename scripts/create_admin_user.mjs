// Bootstrap/update the real Supabase Auth admin user + profiles row.
// Run: node --env-file=.env.local scripts/create_admin_user.mjs
// Reads ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME from the environment (pass them inline on the command, never hardcode here).
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase()
const adminPassword = process.env.ADMIN_PASSWORD || ""
const adminName = process.env.ADMIN_NAME || "Administrador"

if (!supabaseUrl || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados (.env.local)")
if (!adminEmail || !adminPassword) throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente antes de rodar")
if (adminPassword.length < 6) throw new Error("ADMIN_PASSWORD precisa ter pelo menos 6 caracteres")

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const permissions = [
  "dashboard", "clientes_obras", "ordens_servico", "equipe_prestadores", "operacao_campo",
  "frota", "estoque", "financeiro", "comercial", "pmoc", "orcamento", "contratos",
  "relatorios", "configuracoes", "users",
]

const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()
if (listError) throw listError
const existing = existingUsers.users.find(u => u.email?.toLowerCase() === adminEmail)

let userId
if (existing) {
  const { error } = await supabase.auth.admin.updateUserById(existing.id, {
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: adminName, role: "admin", page_permissions: permissions },
  })
  if (error) throw error
  userId = existing.id
  console.log(`Usuário existente atualizado: ${adminEmail}`)
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: adminName, role: "admin", page_permissions: permissions },
  })
  if (error) throw error
  userId = data.user.id
  console.log(`Usuário criado: ${adminEmail}`)
}

const { error: profileError } = await supabase.from("profiles").upsert({
  id: userId,
  email: adminEmail,
  role: "admin",
  full_name: adminName,
  page_permissions: permissions,
  active: true,
  updated_at: new Date().toISOString(),
})
if (profileError) throw profileError

console.log(`Perfil admin pronto para ${adminEmail}. Pode logar normalmente na tela /login.`)
