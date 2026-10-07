import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { systemPagePermissions, type PagePermission } from "@/lib/types"

export const USER_ROLES = ["admin", "manager", "support", "finance", "commercial", "client", "user"] as const
export type UserRoleValue = (typeof USER_ROLES)[number]
export const MIN_PASSWORD = 8

/** Regras mínimas de senha (as mesmas mostradas na tela). */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`
  if (password.length > 72) return "A senha pode ter no máximo 72 caracteres."
  return null
}

export function effectivePermissions(role: string, permissions: unknown): PagePermission[] {
  if (role === "admin") return systemPagePermissions
  return (Array.isArray(permissions) ? permissions : []).filter((p): p is PagePermission => systemPagePermissions.includes(p))
}

/** Usuário logado (sessão por cookie) — ou resposta de erro. */
export async function sessionUser() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }), user: null }
  return { error: null, user }
}

/** Garante que quem chama é administrador ativo. */
export async function requireAdmin() {
  const { error, user } = await sessionUser()
  if (error) return { error, user: null, admin: null }
  const admin = createAdminClient()
  const { data: profile } = await admin.from("profiles").select("role, active").eq("id", user!.id).maybeSingle()
  if (profile?.role !== "admin" || profile.active === false) return { error: NextResponse.json({ error: "Somente administradores." }, { status: 403 }), user: null, admin: null }
  return { error: null, user: user!, admin }
}
