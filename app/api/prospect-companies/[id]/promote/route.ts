import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { data: company, error: companyError } = await supabase
      .from("prospect_companies")
      .select("*")
      .eq("id", id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
    }

    if (company.linked_opportunity_id) {
      return NextResponse.json({ error: "Empresa já promovida para o pipeline" }, { status: 409 })
    }

    const { data: opportunity, error: opportunityError } = await supabase
      .from("commercial_opportunities")
      .insert({
        company_name: company.company_name,
        cnpj: company.cnpj,
        phone: company.telefone,
        email: company.email,
        socios: company.socios ?? [],
        stage: "prospeccao",
        notes: `Importado da base de CNAE/SC · ${company.municipio ?? ""}`.trim(),
      })
      .select("*")
      .single()

    if (opportunityError) {
      console.error("[v0] Error creating opportunity from prospect:", opportunityError)
      return NextResponse.json({ error: opportunityError.message }, { status: 500 })
    }

    const { error: linkError } = await supabase
      .from("prospect_companies")
      .update({ linked_opportunity_id: opportunity.id })
      .eq("id", id)

    if (linkError) {
      console.error("[v0] Error linking prospect to opportunity:", linkError)
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }

    return NextResponse.json({ opportunity })
  } catch (error) {
    console.error("[v0] Error promoting prospect company:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
