import { NextResponse } from "next/server"
import { effectivePermissions, passwordProblem, requireAdmin, USER_ROLES } from "@/lib/server/users"

/**
 * Edita um usuário (somente administradores): dados, função, páginas, ativo/bloqueado
 * e redefinição de senha (a nova senha vira provisória: o usuário troca no próximo acesso).
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, admin, user } = await requireAdmin()
  if (error) return error
  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const { data: current } = await admin!.from("profiles").select("*").eq("id", id).maybeSingle()
  const { data: authData } = await admin!.auth.admin.getUserById(id)
  if (!current || !authData?.user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })

  const isSelf = id === user!.id
  const role = body.role === undefined ? current.role : USER_ROLES.includes(body.role) ? body.role : null
  if (!role) return NextResponse.json({ error: "Função inválida." }, { status: 400 })
  // Evita que o administrador se tranque fora do sistema.
  if (isSelf && (role !== "admin" || body.active === false)) return NextResponse.json({ error: "Você não pode remover o próprio acesso de administrador nem se bloquear." }, { status: 400 })

  const permissions = body.permissions === undefined && body.role === undefined ? current.page_permissions : effectivePermissions(role, body.permissions ?? current.page_permissions)
  if (role !== "admin" && !permissions.length) return NextResponse.json({ error: "Selecione pelo menos uma página." }, { status: 400 })

  const email = body.email === undefined ? current.email : String(body.email).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 })
  const name = body.name === undefined ? current.full_name : String(body.name).trim()
  if (!name) return NextResponse.json({ error: "Informe o nome." }, { status: 400 })

  if (body.password) {
    const problem = passwordProblem(body.password)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })
  }

  const metadata: Record<string, unknown> = { ...(authData.user.user_metadata ?? {}), full_name: name, role, page_permissions: permissions }
  if (body.password) metadata.must_change_password = !isSelf
  const { error: authError } = await admin!.auth.admin.updateUserById(id, {
    ...(email !== authData.user.email ? { email, email_confirm: true } : {}),
    ...(body.password ? { password: body.password } : {}),
    user_metadata: metadata,
  })
  if (authError) return NextResponse.json({ error: /already|registered|exists/i.test(authError.message) ? "Já existe um usuário com este e-mail." : authError.message }, { status: 400 })

  const { error: dbError } = await admin!.from("profiles").update({
    full_name: name,
    email,
    phone: body.phone === undefined ? current.phone : body.phone ? String(body.phone).trim() : null,
    role,
    page_permissions: permissions,
    active: body.active === undefined ? current.active : body.active !== false,
    updated_at: new Date().toISOString(),
  }).eq("id", id)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
