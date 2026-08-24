import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const STAGES = ["prospeccao", "qualificacao", "proposta", "negociacao", "ganho", "perdido"] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const updateData: Record<string, unknown> = {}

    if (body.stage !== undefined) {
      if (!STAGES.includes(body.stage)) {
        return NextResponse.json({ error: "Stage inválida" }, { status: 400 })
      }
      updateData.stage = body.stage
    }
    if (body.company_name !== undefined) updateData.company_name = body.company_name
    if (body.cnpj !== undefined) updateData.cnpj = body.cnpj
    if (body.contact_name !== undefined) updateData.contact_name = body.contact_name
    if (body.email !== undefined) updateData.email = body.email
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.socios !== undefined) updateData.socios = Array.isArray(body.socios) ? body.socios.filter(Boolean) : []
    if (body.estimated_value !== undefined) updateData.estimated_value = body.estimated_value
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.next_action_at !== undefined) updateData.next_action_at = body.next_action_at

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("commercial_opportunities")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error updating commercial_opportunity:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ opportunity: data })
  } catch (error) {
    console.error("[v0] Error updating commercial_opportunity:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { error } = await supabase.from("commercial_opportunities").delete().eq("id", id)

    if (error) {
      console.error("[v0] Error deleting commercial_opportunity:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting commercial_opportunity:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
