import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const STATUSES = ["triagem", "a_fazer", "em_andamento", "aguardando_cliente", "concluido"] as const
const PRIORITIES = ["baixa", "media", "alta"] as const

async function checkApiKey(request: Request) {
  const key = request.headers.get("x-api-key")
  if (!key) return false
  const supabase = createAdminClient()
  const { data } = await supabase.from("integration_settings").select("agent_api_key").eq("id", "default").maybeSingle()
  return Boolean(data?.agent_api_key) && key === data?.agent_api_key
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkApiKey(request))) return NextResponse.json({ error: "Chave de API inválida" }, { status: 401 })
  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data, error } = await supabase.from("tasks").select("*, task_attachments(*)").eq("id", id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 })
    return NextResponse.json({ task: data })
  } catch (error) {
    console.error("[v0] Error fetching task for agent:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkApiKey(request))) return NextResponse.json({ error: "Chave de API inválida" }, { status: 401 })
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
    if (body.description !== undefined) updateData.description = body.description
    if (body.due_date !== undefined) updateData.due_date = body.due_date || null

    if (Object.keys(updateData).length === 0) return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", id)
      .select("*, task_attachments(*)")
      .single()

    if (error) {
      console.error("[v0] Error updating task via agent:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task: data })
  } catch (error) {
    console.error("[v0] Error updating task via agent:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
