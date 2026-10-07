import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

/** Links temporários (30 min) das partes da gravação: faixa "mic" (anfitrião) e "tab" (participantes). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data: parts } = await supabase.from("meeting_audio_parts").select("track, part_index, path, start_offset_seconds, duration_seconds").eq("meeting_id", id).in("track", ["mic", "tab"]).order("part_index").order("track")
    if (!parts?.length) return NextResponse.json({ error: "Esta reunião não tem áudio." }, { status: 404 })
    const { data: signed, error } = await supabase.storage.from("reunioes-audio").createSignedUrls(parts.map((p) => p.path), 1800)
    if (error || !signed) return NextResponse.json({ error: "Não foi possível gerar os links do áudio." }, { status: 500 })
    return NextResponse.json({
      parts: parts.map((p, i) => ({ track: p.track, index: p.part_index, start: Number(p.start_offset_seconds), duration: p.duration_seconds ? Number(p.duration_seconds) : null, url: signed[i]?.signedUrl ?? null })),
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro" }, { status: 500 })
  }
}
