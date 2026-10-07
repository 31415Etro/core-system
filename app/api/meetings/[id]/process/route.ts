import { after, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { processMeeting } from "@/lib/server/meet-process"

export const maxDuration = 300

/** Reprocessa a reunião (ex.: depois de um erro, ou para gerar a ata de novo). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // { retranscribe: true } transcreve o áudio de novo; sem isso, reaproveita a transcrição (poupa a cota gratuita).
  const { retranscribe = false } = await request.json().catch(() => ({}))
  const { data } = await createAdminClient().from("meetings").select("id, status").eq("id", id).maybeSingle()
  if (!data) return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 })
  if (data.status === "gravando") return NextResponse.json({ error: "A reunião ainda está sendo gravada." }, { status: 409 })
  await createAdminClient().from("meetings").update({ status: "processando", error: null }).eq("id", id)
  after(() => processMeeting(id, { retranscribe: Boolean(retranscribe) }))
  return NextResponse.json({ ok: true })
}
