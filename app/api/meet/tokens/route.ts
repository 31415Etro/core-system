import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { currentProfileId } from "@/lib/server/leads"
import { generateToken, hashToken } from "@/lib/server/meet-auth"

const notInstalled = (message: string) => /does not exist|Could not find the table/i.test(message)

/** Tokens da extensão CORE Meet (nunca devolve o token, só o prefixo). */
export async function GET() {
  try {
    const { data, error } = await createAdminClient()
      .from("extension_tokens")
      .select("id, name, token_prefix, created_at, last_used_at, revoked_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ error: notInstalled(error.message) ? "Execute o script 221_core_meet.sql." : error.message, code: notInstalled(error.message) ? "not_installed" : undefined }, { status: notInstalled(error.message) ? 503 : 500 })
    return NextResponse.json({ tokens: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro" }, { status: 500 })
  }
}

/** Gera um token novo. O valor completo aparece só nesta resposta. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : "Chrome"
    const token = generateToken()
    const { error } = await createAdminClient().from("extension_tokens").insert({
      name,
      token_hash: hashToken(token),
      token_prefix: token.slice(0, 12),
      created_by: await currentProfileId(),
    })
    if (error) return NextResponse.json({ error: notInstalled(error.message) ? "Execute o script 221_core_meet.sql." : error.message }, { status: 500 })
    return NextResponse.json({ token }, { status: 201, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro" }, { status: 500 })
  }
}
