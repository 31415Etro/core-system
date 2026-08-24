import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { uploadClientContract } from "@/lib/storage"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const formData = await request.formData()
    const file = formData.get("contract")

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Envie um arquivo PDF" }, { status: 400 })
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "O contrato deve ser um PDF" }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "O arquivo deve ter até 10MB" }, { status: 400 })
    }

    const uploaded = await uploadClientContract(id, file)

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("client_financials")
      .upsert({
        client_id: id,
        contract_file_name: uploaded.file_name,
        contract_storage_path: uploaded.storage_path,
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
    console.error("[v0] Error uploading contract:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 })
  }
}
