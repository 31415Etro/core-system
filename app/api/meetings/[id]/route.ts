import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("meetings")
      .select("*, client:clients(id, name), lead:commercial_opportunities(id, company_name, stage), meeting_tasks(*, client:clients(id, name)), meeting_pending(*), meeting_audio_parts(id, track)")
      .eq("id", id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 })
    return NextResponse.json({ meeting: data })
  } catch (error) {
    console.error("[meet] detail error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** Edita título e vínculo (tipo, cliente ou lead) da reunião. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const update: Record<string, unknown> = {}
    if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim().slice(0, 160)
    if (["interna", "cliente", "lead"].includes(body.type)) {
      update.type = body.type
      update.client_id = body.type === "cliente" ? body.client_id || null : null
      update.lead_id = body.type === "lead" ? body.lead_id || null : null
    }
    const { error } = await createAdminClient().from("meetings").update(update).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro" }, { status: 500 })
  }
}

/** Exclui a reunião (ata, transcrição, sugestões), o áudio e o vídeo. Botão visível só para administradores. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data: parts } = await supabase.from("meeting_audio_parts").select("path, track").eq("meeting_id", id)
    const audio = (parts ?? []).filter((p) => p.track !== "video").map((p) => p.path)
    const video = (parts ?? []).filter((p) => p.track === "video").map((p) => p.path)
    if (audio.length) await supabase.storage.from("reunioes-audio").remove(audio)
    if (video.length) await supabase.storage.from("reunioes-video").remove(video)
    const { error } = await supabase.from("meetings").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro" }, { status: 500 })
  }
}
