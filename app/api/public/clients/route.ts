import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("clients")
      .select("id, name")
      .eq("status", "active")
      .order("name", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching public clients:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ clients: data ?? [] })
  } catch (error) {
    console.error("[v0] Error fetching public clients:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
