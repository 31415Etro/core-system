import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { currentProfileId, LEAD_SELECT, logLeadActivity, pickLeadFields } from "@/lib/server/leads"

export async function GET() {
  try {
    const supabase = createAdminClient()
    let { data, error } = await supabase
      .from("commercial_opportunities")
      .select(LEAD_SELECT)
      .order("created_at", { ascending: false })

    // Sem o relacionamento com profiles disponível, devolve os leads sem o nome do responsável.
    if (error) {
      ;({ data, error } = await supabase.from("commercial_opportunities").select("*").order("created_at", { ascending: false }))
    }

    if (error) {
      console.error("[v0] Error fetching commercial_opportunities:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ opportunities: data ?? [] })
  } catch (error) {
    console.error("[v0] Error fetching commercial_opportunities:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Importação em lote (Leads → Importar): { leads: [{ company_name, ... }] }
    if (Array.isArray(body.leads)) {
      const rows = body.leads
        .map((lead: Record<string, unknown>) => ({ ...pickLeadFields(lead), company_name: typeof lead.company_name === "string" ? lead.company_name.trim() : "" }))
        .filter((row: { company_name: string }) => row.company_name)
        .slice(0, 1000)
      if (!rows.length) return NextResponse.json({ error: "Nenhuma linha válida para importar" }, { status: 400 })

      const supabase = createAdminClient()
      const { data, error } = await supabase.from("commercial_opportunities").insert(rows).select("id, stage")
      if (error) {
        console.error("[core] Error importing leads:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      const createdBy = await currentProfileId()
      const { error: actError } = await supabase.from("lead_activities").insert((data ?? []).map((row) => ({ opportunity_id: row.id, kind: "created", description: "Lead importado", to_stage: row.stage, created_by: createdBy })))
      if (actError) console.error("[core] Falha ao registrar atividades da importação:", actError.message)
      return NextResponse.json({ imported: data?.length ?? 0 }, { status: 201 })
    }

    const companyName = typeof body.company_name === "string" ? body.company_name.trim() : ""

    if (!companyName) {
      return NextResponse.json({ error: "Nome da empresa é obrigatório" }, { status: 400 })
    }

    const supabase = createAdminClient()
    // A etapa inicial vem do default do banco ("novo_lead" após a migration 219).
    const { data, error } = await supabase
      .from("commercial_opportunities")
      .insert({ ...pickLeadFields(body), company_name: companyName })
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error creating commercial_opportunity:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logLeadActivity(supabase, { opportunity_id: data.id, kind: "created", description: "Lead criado", to_stage: data.stage, created_by: await currentProfileId() })

    return NextResponse.json({ opportunity: data }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating commercial_opportunity:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
