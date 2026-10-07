import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, legal_name, document, email, phone, contact_name, contact_phone, contact_email, notes, status, created_at, support_contracts(monthly_value, due_day, plan_name)")
      .eq("id", id)
      .maybeSingle()

    if (error) {
      console.error("[core] Error fetching client:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
    return NextResponse.json({ client: data })
  } catch (error) {
    console.error("[core] Error fetching client:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
