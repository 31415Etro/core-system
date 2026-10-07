import { NextResponse } from "next/server"
import { createClient as createAnonClient } from "@supabase/supabase-js"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { passwordProblem, sessionUser } from "@/lib/server/users"

/**
 * Troca da própria senha. Body: { currentPassword, newPassword }.
 * A senha atual é conferida (exceto na troca obrigatória do primeiro acesso, logo após o login).
 */
export async function POST(request: Request) {
  const { error, user } = await sessionUser()
  if (error) return error
  const body = await request.json().catch(() => ({}))
  // Dados atuais do Auth (o token da sessão pode estar desatualizado).
  const { data: fresh } = await createAdminClient().auth.admin.getUserById(user!.id)
  const metadata = fresh.user?.user_metadata ?? user!.user_metadata ?? {}
  const mustChange = metadata.must_change_password === true

  const problem = passwordProblem(body.newPassword)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  if (!mustChange || body.currentPassword) {
    if (!body.currentPassword) return NextResponse.json({ error: "Informe a senha atual." }, { status: 400 })
    // Confere a senha atual num cliente separado, sem mexer nos cookies da sessão.
    const probe = createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: wrong } = await probe.auth.signInWithPassword({ email: user!.email!, password: body.currentPassword })
    if (wrong) return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 })
    // Encerra só a sessão usada na conferência (o padrão "global" derrubaria a sessão atual também).
    await probe.auth.signOut({ scope: "local" }).catch(() => {})
  }
  if (body.currentPassword && body.currentPassword === body.newPassword) return NextResponse.json({ error: "A nova senha precisa ser diferente da atual." }, { status: 400 })

  // Troca pela própria sessão: o Supabase mantém esta sessão ativa e encerra as de outros dispositivos.
  const session = await createClient()
  const { error: updateError } = await session.auth.updateUser({ password: body.newPassword, data: { ...metadata, must_change_password: false } })
  if (updateError) {
    const same = /different from the old|same/i.test(updateError.message)
    return NextResponse.json({ error: same ? "A nova senha precisa ser diferente da atual." : updateError.message }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
