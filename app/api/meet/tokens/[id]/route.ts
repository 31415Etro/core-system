import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

/** Revoga um token: a extensão que o usa deixa de funcionar na hora. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { error } = await createAdminClient().from("extension_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro" }, { status: 500 })
  }
}
