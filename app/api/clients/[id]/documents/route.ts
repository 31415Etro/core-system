import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { currentProfileId } from "@/lib/server/leads"

const CATEGORIES = ["contrato", "aditivo", "proposta", "nota_fiscal", "documento", "outro"]

/**
 * Documentos do cliente. Inclui também, como somente leitura, os PDFs já anexados
 * em "Financeiro do projeto" (contrato e apresentações), para tudo ficar em um lugar só.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const [docsResult, financialsResult] = await Promise.all([
      supabase.from("client_documents").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("client_financials")
        .select("contract_file_name, contract_storage_path, contract_uploaded_at, welcome_presentation_file_name, welcome_presentation_storage_path, schedule_presentation_file_name, schedule_presentation_storage_path")
        .eq("client_id", id)
        .maybeSingle(),
    ])

    const notInstalled = docsResult.error && (docsResult.error.code === "42P01" || /does not exist|Could not find the table/i.test(docsResult.error.message))
    if (docsResult.error && !notInstalled) {
      console.error("[core] Error fetching client documents:", docsResult.error)
      return NextResponse.json({ error: docsResult.error.message }, { status: 500 })
    }

    const f = financialsResult.data
    const legacy = f ? [
      f.contract_storage_path && { id: "legacy-contract", category: "contrato", title: "Contrato (financeiro do projeto)", file_name: f.contract_file_name, created_at: f.contract_uploaded_at, legacy: true },
      f.welcome_presentation_storage_path && { id: "legacy-welcome", category: "documento", title: "Apresentação de boas-vindas", file_name: f.welcome_presentation_file_name, created_at: null, legacy: true },
      f.schedule_presentation_storage_path && { id: "legacy-schedule", category: "documento", title: "Apresentação de cronograma", file_name: f.schedule_presentation_file_name, created_at: null, legacy: true },
    ].filter(Boolean) : []

    return NextResponse.json({ documents: docsResult.data ?? [], legacy, installed: !notInstalled })
  } catch (error) {
    console.error("[core] Error fetching client documents:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** Registra um PDF já enviado ao Storage pela URL assinada (o arquivo não passa por esta rota). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const storagePath = typeof body.storage_path === "string" ? body.storage_path : ""
    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (!storagePath.startsWith(`documentos/${id}/`)) return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 })
    if (!title) return NextResponse.json({ error: "Informe um título para o documento" }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("client_documents")
      .insert({
        client_id: id,
        category: CATEGORIES.includes(body.category) ? body.category : "documento",
        title,
        file_name: String(body.file_name || "documento.pdf"),
        storage_path: storagePath,
        file_size_bytes: Number(body.file_size_bytes) || null,
        signed_at: body.signed_at || null,
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        uploaded_by: await currentProfileId(),
      })
      .select("*")
      .single()

    if (error) {
      console.error("[core] Error registering client document:", error)
      return NextResponse.json({ error: /does not exist|Could not find the table/i.test(error.message) ? "Execute o script 220_client_vault_documents.sql para habilitar os documentos." : error.message }, { status: 500 })
    }
    return NextResponse.json({ document: data }, { status: 201 })
  } catch (error) {
    console.error("[core] Error registering client document:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
