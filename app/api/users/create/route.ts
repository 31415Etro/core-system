import { NextResponse } from "next/server"
import { effectivePermissions, passwordProblem, requireAdmin, USER_ROLES } from "@/lib/server/users"

/**
 * Cria um usuário (Supabase Auth + perfil). Somente administradores.
 * A senha inicial é provisória: no primeiro acesso o usuário é obrigado a trocá-la.
 */
export async function POST(request: Request) {
  const { error, admin } = await requireAdmin()
  if (error) return error

  const body = await request.json().catch(() => ({}))
  const email = String(body.email ?? "").trim().toLowerCase()
  const name = String(body.name ?? "").trim()
  const role = USER_ROLES.includes(body.role) ? body.role : null
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 })
  if (!name) return NextResponse.json({ error: "Informe o nome." }, { status: 400 })
  if (!role) return NextResponse.json({ error: "Função inválida." }, { status: 400 })
  const problem = passwordProblem(body.password)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })
  const permissions = effectivePermissions(role, body.permissions)
  if (role !== "admin" && !permissions.length) return NextResponse.json({ error: "Selecione pelo menos uma página." }, { status: 400 })

  const { data: created, error: authError } = await admin!.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: name, role, page_permissions: permissions, must_change_password: body.mustChangePassword !== false },
  })
  if (authError) {
    const exists = /already|registered|exists/i.test(authError.message)
    return NextResponse.json({ error: exists ? "Já existe um usuário com este e-mail." : authError.message }, { status: 400 })
  }

  const { error: profileError } = await admin!.from("profiles").upsert({
    id: created.user.id,
    email,
    full_name: name,
    phone: body.phone ? String(body.phone).trim() : null,
    role,
    page_permissions: permissions,
    active: true,
    updated_at: new Date().toISOString(),
  })
  if (profileError) {
    await admin!.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: `Não foi possível criar o perfil: ${profileError.message}` }, { status: 500 })
  }
  return NextResponse.json({ success: true, id: created.user.id }, { status: 201 })
}
