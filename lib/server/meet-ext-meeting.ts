import { extJson } from "@/lib/server/meet-auth"
import type { ExtensionAuth } from "@/lib/server/meet-auth"
import { createAdminClient } from "@/lib/supabase/server"

/** Garante que a reunião foi criada por este mesmo token de extensão. */
export async function ownMeeting(auth: ExtensionAuth, meetingId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase.from("meetings").select("id, status, started_at, extension_token_id").eq("id", meetingId).maybeSingle()
  if (!data || data.extension_token_id !== auth.tokenId) return { error: extJson({ error: "Reunião não encontrada." }, { status: 404 }), supabase, meeting: null }
  return { error: null, supabase, meeting: data }
}
