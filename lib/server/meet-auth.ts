import { createHash, randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

/**
 * Autenticação da extensão CORE Meet.
 * A extensão não tem a sessão do navegador da CORE: usa um token gerado em
 * Reuniões → Conectar extensão. O banco guarda só o hash SHA-256 do token.
 */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")
export const generateToken = () => `cmeet_${randomBytes(24).toString("base64url")}`

// A extensão chama de chrome-extension://; o acesso é por token (sem cookies), então liberar a origem é seguro.
export const EXT_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
}

export function extJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { status: init?.status ?? 200, headers: EXT_CORS })
}

export const extOptions = () => new NextResponse(null, { status: 204, headers: EXT_CORS })

export type ExtensionAuth = { tokenId: string; userId: string | null; name: string }

export async function authenticateExtension(request: Request): Promise<ExtensionAuth | NextResponse> {
  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (!token.startsWith("cmeet_")) return extJson({ error: "Token da extensão ausente ou inválido." }, { status: 401 })

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("extension_tokens")
      .select("id, name, created_by, revoked_at")
      .eq("token_hash", hashToken(token))
      .maybeSingle()
    if (error) {
      const missing = /does not exist|Could not find the table/i.test(error.message)
      return extJson({ error: missing ? "Reuniões ainda não instaladas no banco: execute o script 221_core_meet.sql." : "Erro ao validar token." }, { status: missing ? 503 : 500 })
    }
    if (!data || data.revoked_at) return extJson({ error: "Token revogado ou inexistente. Gere um novo em Reuniões → Conectar extensão." }, { status: 401 })

    await supabase.from("extension_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id)
    return { tokenId: data.id, userId: data.created_by, name: data.name }
  } catch (err) {
    console.error("[meet] auth error:", err instanceof Error ? err.message : err)
    return extJson({ error: "Servidor da CORE sem acesso ao banco (verifique o .env)." }, { status: 500 })
  }
}
