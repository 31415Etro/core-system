import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { currentProfileId } from "@/lib/server/leads"

const MANUAL_KINDS = ["note", "call", "email", "whatsapp", "meeting"]

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    let { data, error } = await supabase
      .from("lead_activities")
      .select("*, author:profiles!created_by(full_name)")
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false })
    if (error) ({ data, error } = await supabase.from("lead_activities").select("*").eq("opportunity_id", id).order("created_at", { ascending: false }))

    if (error) {
      console.error("[core] Error fetching lead_activities:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ activities: data ?? [] })
  } catch (error) {
    console.error("[core] Error fetching lead_activities:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const kind = MANUAL_KINDS.includes(body.kind) ? body.kind : "note"
    const description = typeof body.description === "string" ? body.description.trim() : ""
    if (!description) return NextResponse.json({ error: "Descreva a atividade" }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("lead_activities")
      .insert({ opportunity_id: id, kind, description, created_by: await currentProfileId() })
      .select("*")
      .single()

    if (error) {
      console.error("[core] Error creating lead_activity:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ activity: data }, { status: 201 })
  } catch (error) {
    console.error("[core] Error creating lead_activity:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
