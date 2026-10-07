import { NextResponse } from "next/server"
import { readCredentialBody, vaultClient, vaultError } from "@/lib/server/vault"

/** Edita o acesso. Senha só é trocada se uma nova for enviada. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; credentialId: string }> }) {
  try {
    const { credentialId } = await params
    const body = readCredentialBody(await request.json())
    if (!body.label || !body.username) return NextResponse.json({ error: "Informe o nome do acesso e o usuário." }, { status: 400 })

    const { supabase, error: authError } = await vaultClient()
    if (authError) return authError

    const { error } = await supabase.rpc("update_client_credential", {
      p_credential_id: credentialId,
      p_access_type: body.access_type,
      p_label: body.label,
      p_username: body.username,
      p_host: body.host,
      p_notes: body.notes,
      p_secret: body.secret || null,
    })
    if (error) return vaultError(error, "Erro ao atualizar o acesso")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[core] Error updating credential:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** Desativa o acesso (deixa de aparecer e não pode mais ser revelado; o histórico fica). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; credentialId: string }> }) {
  try {
    const { credentialId } = await params
    const { supabase, error: authError } = await vaultClient()
    if (authError) return authError

    const { error } = await supabase.rpc("deactivate_client_credential", { p_credential_id: credentialId })
    if (error) return vaultError(error, "Erro ao remover o acesso")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[core] Error deactivating credential:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
