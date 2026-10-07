import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const LIST_SELECT = "id, type, title, status, started_at, ended_at, duration_seconds, participants, summary, next_meeting, error, client_id, lead_id, client:clients(id, name), lead:commercial_opportunities(id, company_name), meeting_tasks(id, status), meeting_pending(id, side, done), meeting_audio_parts(id, track)"

/** Lista reuniões. Filtros opcionais: ?lead_id= / ?client_id= */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const full = searchParams.get("full") === "1"
    let query = createAdminClient().from("meetings").select(full ? LIST_SELECT.replace("meeting_tasks(id, status), meeting_pending(id, side, done), meeting_audio_parts(id, track)", "meeting_tasks(*), meeting_pending(*), meeting_audio_parts(id, track)") : LIST_SELECT).order("started_at", { ascending: false }).limit(300)
    const leadId = searchParams.get("lead_id")
    const clientId = searchParams.get("client_id")
    if (leadId) query = query.eq("lead_id", leadId)
    if (clientId) query = query.eq("client_id", clientId)

    const { data, error } = await query
    if (error) {
      const missing = /does not exist|Could not find the table/i.test(error.message)
      return NextResponse.json({ error: missing ? "Reuniões ainda não instaladas: execute o script 221_core_meet.sql." : error.message, code: missing ? "not_installed" : undefined }, { status: missing ? 503 : 500 })
    }
    return NextResponse.json({ meetings: data ?? [] })
  } catch (error) {
    console.error("[meet] list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
