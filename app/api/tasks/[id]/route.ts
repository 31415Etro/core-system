import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const STATUSES = ["triagem", "a_fazer", "em_andamento", "aguardando_cliente", "concluido"] as const
const PRIORITIES = ["baixa", "media", "alta"] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const updateData: Record<string, unknown> = {}

    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Status inválido" }, { status: 400 })
      updateData.status = body.status
    }
    if (body.priority !== undefined) {
      if (!PRIORITIES.includes(body.priority)) return NextResponse.json({ error: "Prioridade inválida" }, { status: 400 })
      updateData.priority = body.priority
    }
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.assignee_id !== undefined) updateData.assignee_id = body.assignee_id || null
    if (body.due_date !== undefined) updateData.due_date = body.due_date || null

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", id)
      .select("*, task_attachments(*)")
      .single()

    if (error) {
      console.error("[v0] Error updating task:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task: data })
  } catch (error) {
    console.error("[v0] Error updating task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { error } = await supabase.from("tasks").delete().eq("id", id)

    if (error) {
      console.error("[v0] Error deleting task:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
