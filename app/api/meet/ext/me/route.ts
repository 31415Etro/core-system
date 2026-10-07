import { authenticateExtension, extJson, extOptions } from "@/lib/server/meet-auth"
import { createAdminClient } from "@/lib/supabase/server"
import { transcriptionEnabled } from "@/lib/server/meet-ai"

export const OPTIONS = extOptions

/** Valida o token e devolve quem está conectado (usado no "Conectar" da extensão). */
export async function GET(request: Request) {
  const auth = await authenticateExtension(request)
  if (auth instanceof Response) return auth

  let userName: string | null = null
  if (auth.userId) {
    const { data } = await createAdminClient().from("profiles").select("full_name").eq("id", auth.userId).maybeSingle()
    userName = data?.full_name ?? null
  }
  return extJson({ ok: true, token_name: auth.name, user_name: userName, ai_enabled: Boolean(process.env.ANTHROPIC_API_KEY), transcription_enabled: transcriptionEnabled() })
}
