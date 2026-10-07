import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

/** Feed global de atividades comerciais (Leads → Atividades). */
export async function GET() {
  try {
    const supabase = createAdminClient()
    let { data, error } = await supabase
      .from("lead_activities")
      .select("*, lead:commercial_opportunities!opportunity_id(id, company_name), author:profiles!created_by(full_name)")
      .order("created_at", { ascending: false })
      .limit(200)
    if (error) ({ data, error } = await supabase.from("lead_activities").select("*").order("created_at", { ascending: false }).limit(200))

    if (error) {
      console.error("[core] Error fetching lead activity feed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ activities: data ?? [] })
  } catch (error) {
    console.error("[core] Error fetching lead activity feed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
