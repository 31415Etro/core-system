import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST() {
  try {
    const supabase = createAdminClient()
    const newKey = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")
    const { data, error } = await supabase
      .from("integration_settings")
      .upsert({ id: "default", agent_api_key: newKey, updated_at: new Date().toISOString() }, { onConflict: "id" })
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error regenerating agent api key:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings: data })
  } catch (error) {
    console.error("[v0] Error regenerating agent api key:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
