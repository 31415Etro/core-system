import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const fileName = String(body.file_name || "").trim()
    const storagePath = String(body.storage_path || "").trim()

    if (!fileName || !storagePath) return NextResponse.json({ error: "Upload incompleto" }, { status: 400 })
    if (!storagePath.startsWith(`contratos/${id}/`)) return NextResponse.json({ error: "Caminho de arquivo inválido" }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("client_financials")
      .upsert({
        client_id: id,
        contract_file_name: fileName,
        contract_storage_path: storagePath,
        contract_uploaded_at: new Date().toISOString(),
      }, { onConflict: "client_id" })
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error saving contract reference:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ financials: data }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error saving contract reference:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 })
  }
}
