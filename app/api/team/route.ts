import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

/** Equipe interna ativa (para seletores de responsável). Retorna só dados não sensíveis. */
export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("active", true)
      .neq("role", "client")
      .order("full_name", { ascending: true })

    if (error) {
      console.error("[core] Error fetching team:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ team: data ?? [] })
  } catch (error) {
    console.error("[core] Error fetching team:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
