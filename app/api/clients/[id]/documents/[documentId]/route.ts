import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getSignedClientDocumentUrl, removeClientDocument } from "@/lib/storage"

const LEGACY_COLUMNS: Record<string, string> = {
  "legacy-contract": "contract_storage_path",
  "legacy-welcome": "welcome_presentation_storage_path",
  "legacy-schedule": "schedule_presentation_storage_path",
}

/** Gera um link temporário (5 min) para abrir/baixar o PDF. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { id, documentId } = await params
    const supabase = createAdminClient()

    let path: string | null = null
    let fileName = "documento.pdf"
    if (LEGACY_COLUMNS[documentId]) {
      const { data } = await supabase.from("client_financials").select("*").eq("client_id", id).maybeSingle()
      path = (data as Record<string, string | null> | null)?.[LEGACY_COLUMNS[documentId]] ?? null
    } else {
      const { data } = await supabase.from("client_documents").select("storage_path, file_name").eq("id", documentId).eq("client_id", id).maybeSingle()
      path = data?.storage_path ?? null
      fileName = data?.file_name ?? fileName
    }
    if (!path) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 })

    const download = new URL(request.url).searchParams.get("download") === "1"
    const url = await getSignedClientDocumentUrl(path)
    return NextResponse.json({ url: download ? `${url}&download=${encodeURIComponent(fileName)}` : url }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[core] Error signing client document:", error)
    return NextResponse.json({ error: "Não foi possível gerar o link do documento" }, { status: 500 })
  }
}

/** Exclui o documento (arquivo + registro). O botão só aparece para administradores. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { id, documentId } = await params
    if (LEGACY_COLUMNS[documentId]) return NextResponse.json({ error: "Este arquivo é gerenciado em Financeiro do projeto." }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase.from("client_documents").select("storage_path").eq("id", documentId).eq("client_id", id).maybeSingle()
    if (error || !data) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 })

    await removeClientDocument(data.storage_path)
    const { error: deleteError } = await supabase.from("client_documents").delete().eq("id", documentId)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[core] Error deleting client document:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
