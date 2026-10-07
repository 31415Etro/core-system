import { NextResponse } from "next/server"
import { vaultClient, vaultError } from "@/lib/server/vault"

/** Revela a senha sob demanda. Cada chamada fica registrada em credential_access_log. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string; credentialId: string }> }) {
  try {
    const { credentialId } = await params
    const { supabase, error: authError } = await vaultClient()
    if (authError) return authError

    const { data, error } = await supabase.rpc("reveal_client_credential", { p_credential_id: credentialId })
    if (error) return vaultError(error, "Erro ao revelar a senha")

    return NextResponse.json({ secret: data }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[core] Error revealing credential:", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
