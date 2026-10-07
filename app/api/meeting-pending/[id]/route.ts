import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

/** Marca/desmarca uma pendência de reunião como resolvida. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const done = Boolean(body.done)
    const { error } = await createAdminClient().from("meeting_pending").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro" }, { status: 500 })
  }
}
