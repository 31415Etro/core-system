import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("commercial_opportunities")
      .select("*")
      .order("created_at", { ascending: false })

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
    const companyName = typeof body.company_name === "string" ? body.company_name.trim() : ""

    if (!companyName) {
      return NextResponse.json({ error: "Nome da empresa é obrigatório" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("commercial_opportunities")
      .insert({
        company_name: companyName,
        cnpj: body.cnpj || null,
        contact_name: body.contact_name || null,
        email: body.email || null,
        phone: body.phone || null,
        socios: Array.isArray(body.socios) ? body.socios.filter(Boolean) : [],
        estimated_value: body.estimated_value || 0,
        notes: body.notes || null,
        stage: "prospeccao",
      })
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error creating commercial_opportunity:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ opportunity: data }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating commercial_opportunity:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
