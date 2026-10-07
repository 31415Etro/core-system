import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

/** Links temporários (2 h) das partes do vídeo da reunião, em ordem, para tocar em sequência. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data: parts } = await supabase.from("meeting_audio_parts").select("part_index, path, start_offset_seconds, duration_seconds, bytes").eq("meeting_id", id).eq("track", "video").order("part_index")
    if (!parts?.length) return NextResponse.json({ error: "Esta reunião não tem vídeo." }, { status: 404 })
    const { data: signed, error } = await supabase.storage.from("reunioes-video").createSignedUrls(parts.map((p) => p.path), 7200)
    if (error || !signed) return NextResponse.json({ error: "Não foi possível gerar os links do vídeo." }, { status: 500 })
    return NextResponse.json({
      parts: parts.map((p, i) => ({ index: p.part_index, start: Number(p.start_offset_seconds), duration: p.duration_seconds ? Number(p.duration_seconds) : null, bytes: p.bytes, url: signed[i]?.signedUrl ?? null })),
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro" }, { status: 500 })
  }
}
