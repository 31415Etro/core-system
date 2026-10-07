import { NextResponse } from "next/server"
import { createClientDocumentUploadUrl, type ClientDocumentKind } from "@/lib/storage"

const KINDS: ClientDocumentKind[] = ["contract", "boas-vindas", "cronograma", "documento"]

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const kind = body.kind as ClientDocumentKind
    const fileName = String(body.file_name || "").trim()

    if (!KINDS.includes(kind)) return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 })
    if (!fileName) return NextResponse.json({ error: "Nome do arquivo obrigatório" }, { status: 400 })

    const upload = await createClientDocumentUploadUrl(id, kind, fileName)
    return NextResponse.json(upload)
  } catch (error) {
    console.error("[v0] Error creating client document upload url:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 })
  }
}
