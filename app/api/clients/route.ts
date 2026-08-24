import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, legal_name, document, email, phone, support_contracts(monthly_value, due_day, plan_name)")
      .eq("status", "active")
      .order("name", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching clients:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ clients: data ?? [] })
  } catch (error) {
    console.error("[v0] Error fetching clients:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name) return NextResponse.json({ error: "Nome do cliente é obrigatório" }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name,
        legal_name: body.legal_name || null,
        document: body.document || null,
        email: body.email || null,
        phone: body.phone || null,
        status: "active",
      })
      .select("id, name, legal_name, document, email, phone, support_contracts(monthly_value, due_day, plan_name)")
      .single()

    if (error) {
      console.error("[v0] Error creating client:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ client: data }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating client:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
