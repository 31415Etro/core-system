import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export const ACCESS_TYPES = ["computer", "server", "network", "email", "system", "website", "database", "vpn", "cloud", "other"] as const

/**
 * O cofre usa a sessão do próprio usuário (não a service role): as funções do banco
 * conferem o papel via auth.uid() e registram quem criou/revelou cada senha.
 */
export async function vaultClient() {
  const supabase = await createServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { supabase, error: NextResponse.json({ error: "Entre com uma conta do sistema para usar o cofre de senhas.", code: "no_session" }, { status: 401 }) }
  return { supabase, error: null }
}

/** Traduz erros do banco para respostas claras (sem nunca ecoar a senha). */
export function vaultError(error: { message?: string; code?: string } | null, fallback: string) {
  const message = error?.message ?? ""
  if (/Acesso negado/i.test(message)) return NextResponse.json({ error: "Seu perfil não tem acesso ao cofre (apenas administrador, gestor ou suporte).", code: "forbidden" }, { status: 403 })
  if (/Senha inválida/i.test(message)) return NextResponse.json({ error: "A senha precisa ter ao menos 4 caracteres." }, { status: 400 })
  if (/não encontrada/i.test(message)) return NextResponse.json({ error: "Credencial não encontrada." }, { status: 404 })
  if (error?.code === "42P01" || error?.code === "PGRST202" || /does not exist|Could not find the function/i.test(message)) {
    return NextResponse.json({ error: "O cofre ainda não foi instalado no banco. Execute o script 220_client_vault_documents.sql.", code: "not_installed" }, { status: 503 })
  }
  console.error("[core] vault error:", message)
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export function readCredentialBody(body: Record<string, unknown>) {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const accessType = ACCESS_TYPES.includes(body.access_type as never) ? String(body.access_type) : "other"
  return {
    access_type: accessType,
    label: str(body.label),
    username: str(body.username),
    host: str(body.host) || null,
    notes: str(body.notes) || null,
    // Senha não é "trimada": espaços podem fazer parte dela.
    secret: typeof body.secret === "string" ? body.secret : "",
  }
}
