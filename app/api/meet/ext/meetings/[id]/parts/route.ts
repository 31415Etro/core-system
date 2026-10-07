import { authenticateExtension, extJson, extOptions } from "@/lib/server/meet-auth"
import { ownMeeting } from "@/lib/server/meet-ext-meeting"

export const OPTIONS = extOptions

/** Registra uma parte do áudio ou do vídeo já enviada ao Storage. Body: { track, index, path, start_offset, duration, bytes } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateExtension(request)
  if (auth instanceof Response) return auth
  const { id } = await params
  const { error: notFound, supabase } = await ownMeeting(auth, id)
  if (notFound) return notFound

  const body = await request.json().catch(() => ({}))
  const track = ["mic", "tab", "video"].includes(body.track) ? (body.track as string) : null
  const path = typeof body.path === "string" && body.path.startsWith(`reunioes/${id}/`) ? body.path : null
  if (!track || !path || !Number.isInteger(body.index)) return extJson({ error: "Parte de áudio inválida." }, { status: 400 })

  const { error } = await supabase.from("meeting_audio_parts").upsert({
    meeting_id: id,
    track,
    part_index: body.index,
    path,
    start_offset_seconds: Math.max(0, Number(body.start_offset) || 0),
    duration_seconds: Number(body.duration) || null,
    bytes: Number(body.bytes) || null,
  }, { onConflict: "meeting_id,track,part_index" })
  if (error) return extJson({ error: "Erro ao registrar parte do áudio." }, { status: 500 })
  return extJson({ ok: true })
}
