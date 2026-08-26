import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

async function getOrCreateSettings() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from("integration_settings").select("*").eq("id", "default").maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return data

  const { data: created, error: createError } = await supabase
    .from("integration_settings")
    .insert({ id: "default", agent_api_key: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "") })
    .select("*")
    .single()
  if (createError) throw new Error(createError.message)
  return created
}

export async function GET() {
  try {
    const settings = await getOrCreateSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    console.error("[v0] Error fetching integration settings:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    await getOrCreateSettings()
    const body = await request.json()
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("integration_settings")
      .update({ chamado_webhook_url: body.chamado_webhook_url?.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", "default")
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error saving integration settings:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings: data })
  } catch (error) {
    console.error("[v0] Error saving integration settings:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 })
  }
}
