import { NextResponse } from "next/server"
import { readCredentialBody, vaultClient, vaultError } from "@/lib/server/vault"

/** Lista os acessos do cliente — somente metadados, nunca a senha. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { supabase, error: authError } = await vaultClient()
    if (authError) return authError

    const { data: allowed, error: roleError } = await supabase.rpc("can_manage_client_credentials")
    if (roleError) return vaultError(roleError, "Erro ao verificar acesso ao cofre")
    if (!allowed) return vaultError({ message: "Acesso negado" }, "")

    const { data, error } = await supabase
      .from("client_credentials")
      .select("id, client_id, access_type, label, username, host, notes, created_at, updated_at")
      .eq("client_id", id)
      .eq("active", true)
      .order("access_type")
      .order("label")
    if (error) return vaultError(error, "Erro ao carregar o cofre")

    return NextResponse.json({ credentials: data ?? [] })
  } catch (error) {
    console.error("[core] Error listing credentials:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = readCredentialBody(await request.json())
    if (!body.label || !body.username) return NextResponse.json({ error: "Informe o nome do acesso e o usuário." }, { status: 400 })

    const { supabase, error: authError } = await vaultClient()
    if (authError) return authError

    const { data, error } = await supabase.rpc("create_client_credential", {
      p_client_id: id,
      p_access_type: body.access_type,
      p_label: body.label,
      p_username: body.username,
      p_secret: body.secret,
      p_host: body.host,
      p_notes: body.notes,
    })
    if (error) return vaultError(error, "Erro ao salvar no cofre")

    return NextResponse.json({ id: data }, { status: 201 })
  } catch (error) {
    console.error("[core] Error creating credential:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
