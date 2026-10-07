import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server/users"

/** Lista os usuários do sistema (somente administradores). */
export async function GET() {
  const { error, admin, user } = await requireAdmin()
  if (error) return error

  const [{ data: profiles, error: dbError }, { data: auth }] = await Promise.all([
    admin!.from("profiles").select("id, full_name, email, phone, role, active, page_permissions, created_at").order("full_name"),
    admin!.auth.admin.listUsers({ perPage: 1000 }),
  ])
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  const authById = new Map((auth?.users ?? []).map((u) => [u.id, u]))
  return NextResponse.json({
    users: (profiles ?? []).map((p) => {
      const a = authById.get(p.id)
      return {
        id: p.id,
        name: p.full_name,
        email: p.email,
        phone: p.phone,
        role: p.role,
        active: p.active !== false,
        permissions: p.page_permissions ?? [],
        createdAt: p.created_at,
        lastSignInAt: a?.last_sign_in_at ?? null,
        mustChangePassword: a?.user_metadata?.must_change_password === true,
        isSelf: p.id === user!.id,
      }
    }),
  })
}
