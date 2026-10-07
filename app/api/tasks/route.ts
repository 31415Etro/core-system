import { NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { resolveTaskLinks } from "@/lib/server/task-links"

// Inclui o projeto vinculado (script 223); antes dele a lista cai no select sem projeto.
const TASK_SELECT = "*, task_attachments(*), project:projects(id, name)"

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("tasks")
      .select(TASK_SELECT)
      .order("created_at", { ascending: false })

    if (error && /projects|project_id/i.test(error.message)) {
      const fallback = await supabase.from("tasks").select("*, task_attachments(*)").order("created_at", { ascending: false })
      return NextResponse.json({ tasks: fallback.data ?? [] })
    }
    if (error) {
      console.error("[v0] Error fetching tasks:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tasks: data ?? [] })
  } catch (error) {
    console.error("[v0] Error fetching tasks:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const title = typeof body.title === "string" ? body.title.trim() : ""
    const description = typeof body.description === "string" ? body.description.trim() : ""

    if (!title) return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 })
    if (!description) return NextResponse.json({ error: "Descrição é obrigatória" }, { status: 400 })

    const links = await resolveTaskLinks(body.client_id, body.project_id)
    if (links.error) return NextResponse.json({ error: links.error }, { status: 400 })

    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        kind: "tarefa",
        source: "interno",
        title,
        description,
        priority: ["baixa", "media", "alta"].includes(body.priority) ? body.priority : "media",
        status: "a_fazer",
        assignee_id: body.assignee_id || null,
        due_date: body.due_date || null,
        client_id: links.clientId,
        company_name: links.companyName,
        ...(links.projectId ? { project_id: links.projectId } : {}),
        created_by: user?.id ?? null,
      })
      .select(links.projectId ? TASK_SELECT : "*, task_attachments(*)")
      .single()

    if (error) {
      console.error("[v0] Error creating task:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task: data }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
