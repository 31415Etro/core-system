import { authenticateExtension, extJson, extOptions } from "@/lib/server/meet-auth"
import { ownMeeting } from "@/lib/server/meet-ext-meeting"

export const OPTIONS = extOptions

/** Cancela uma reunião que não chegou a gravar (falha ao iniciar a captura): apaga em vez de deixar com erro na lista. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateExtension(request)
  if (auth instanceof Response) return auth
  const { id } = await params
  const { error: notFound, supabase, meeting } = await ownMeeting(auth, id)
  if (notFound) return notFound
  const { count } = await supabase.from("meeting_audio_parts").select("id", { count: "exact", head: true }).eq("meeting_id", id)
  if (meeting!.status !== "gravando" || count) return extJson({ error: "Esta reunião já tem gravação e não pode ser cancelada." }, { status: 409 })
  await supabase.from("meetings").delete().eq("id", id)
  return extJson({ ok: true })
}
