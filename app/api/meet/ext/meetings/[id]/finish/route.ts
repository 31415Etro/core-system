import { after } from "next/server"
import { authenticateExtension, extJson, extOptions } from "@/lib/server/meet-auth"
import { ownMeeting } from "@/lib/server/meet-ext-meeting"
import { processMeeting } from "@/lib/server/meet-process"

export const OPTIONS = extOptions
// Transcrição + IA rodam depois da resposta (after); reuniões longas podem levar alguns minutos.
export const maxDuration = 300

/** Encerra a reunião e dispara, em segundo plano, a transcrição do áudio e depois a IA. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateExtension(request)
  if (auth instanceof Response) return auth
  const { id } = await params
  const { error: notFound, supabase, meeting } = await ownMeeting(auth, id)
  if (notFound) return notFound
  if (meeting!.status !== "gravando") return extJson({ ok: true, already: true })

  const body = await request.json().catch(() => ({}))
  const endedAt = new Date()
  await supabase.from("meetings").update({
    status: "processando",
    ended_at: endedAt.toISOString(),
    duration_seconds: Math.max(0, Math.round(Number(body.duration_seconds) || (endedAt.getTime() - new Date(meeting!.started_at).getTime()) / 1000)),
    audio_bytes: Number(body.audio_bytes) || null,
    video_bytes: Number(body.video_bytes) || null,
  }).eq("id", id)

  after(() => processMeeting(id))
  return extJson({ ok: true, meeting_id: id })
}
