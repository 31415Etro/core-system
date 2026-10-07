import { authenticateExtension, extJson, extOptions } from "@/lib/server/meet-auth"
import { ownMeeting } from "@/lib/server/meet-ext-meeting"
import { bucketForTrack } from "@/lib/server/meet-process"

export const OPTIONS = extOptions

/**
 * URL assinada para a extensão enviar uma parte do áudio ou do vídeo direto ao Storage
 * (o arquivo não passa pela API — a Vercel limita requisições a 4,5 MB).
 * Body: { track: "mic" | "tab" | "video", index: number }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateExtension(request)
  if (auth instanceof Response) return auth
  const { id } = await params
  const { error: notFound, supabase } = await ownMeeting(auth, id)
  if (notFound) return notFound

  const body = await request.json().catch(() => ({}))
  const track = ["mic", "tab", "video"].includes(body.track) ? (body.track as string) : null
  const index = Number.isInteger(body.index) && body.index >= 0 ? body.index : null
  if (!track || index === null) return extJson({ error: "Parte de áudio inválida." }, { status: 400 })

  const path = `reunioes/${id}/${track}-${String(index).padStart(3, "0")}-${Date.now()}.webm`
  const { data, error } = await supabase.storage.from(bucketForTrack(track)).createSignedUploadUrl(path)
  if (error || !data) return extJson({ error: `Não foi possível preparar o envio${error ? `: ${error.message}` : ""}.` }, { status: 500 })
  return extJson({ path, signed_url: data.signedUrl })
}
