import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { currentProfileId, LEAD_SELECT, LEAD_STAGES, LEGACY_STAGES, logLeadActivity, pickLeadFields } from "@/lib/server/leads"

const STAGES: readonly string[] = [...LEAD_STAGES, ...LEGACY_STAGES]

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    let { data, error } = await supabase.from("commercial_opportunities").select(LEAD_SELECT).eq("id", id).maybeSingle()
    if (error) ({ data, error } = await supabase.from("commercial_opportunities").select("*").eq("id", id).maybeSingle())

    if (error) {
      console.error("[v0] Error fetching commercial_opportunity:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 })

    return NextResponse.json({ opportunity: data })
  } catch (error) {
    console.error("[v0] Error fetching commercial_opportunity:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const updateData: Record<string, unknown> = pickLeadFields(body)
    if (updateData.company_name === null) delete updateData.company_name

    if (body.stage !== undefined) {
      if (!STAGES.includes(body.stage)) {
        return NextResponse.json({ error: "Stage inválida" }, { status: 400 })
      }
      updateData.stage = body.stage
    }

    const supabase = createAdminClient()

    let previousStage: string | null = null
    if (updateData.stage !== undefined) {
      const { data: current } = await supabase.from("commercial_opportunities").select("stage").eq("id", id).maybeSingle()
      previousStage = current?.stage ?? null
    }

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

    const createdBy = await currentProfileId()
    if (updateData.stage === "fechado" && previousStage !== "fechado") {
      const fmt = (v: unknown) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      const parts = [data.closed_value != null && `implantação ${fmt(data.closed_value)}`, data.monthly_value != null && `mensalidade ${fmt(data.monthly_value)}`].filter(Boolean)
      await logLeadActivity(supabase, { opportunity_id: id, kind: "sale", from_stage: previousStage, to_stage: "fechado", description: parts.length ? `Venda registrada: ${parts.join(" + ")}` : "Venda registrada", created_by: createdBy })
    } else if (body.archived !== undefined && Object.keys(updateData).length === 1) {
      await logLeadActivity(supabase, { opportunity_id: id, kind: "update", description: body.archived ? "Lead arquivado" : "Lead restaurado", created_by: createdBy })
    } else if (updateData.stage !== undefined && previousStage !== updateData.stage) {
      await logLeadActivity(supabase, { opportunity_id: id, kind: "stage_change", from_stage: previousStage, to_stage: String(updateData.stage), description: typeof body.lost_reason === "string" && body.lost_reason.trim() ? `Motivo: ${body.lost_reason.trim()}` : null, created_by: createdBy })
    } else if (Object.keys(updateData).length) {
      await logLeadActivity(supabase, { opportunity_id: id, kind: "update", description: "Dados do lead atualizados", created_by: createdBy })
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
