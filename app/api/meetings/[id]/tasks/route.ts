import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { currentProfileId } from "@/lib/server/leads"
import { resolveTaskLinks } from "@/lib/server/task-links"

type Item = { id: string; title?: string; description?: string; due_date?: string | null; priority?: string; scope?: string; client_id?: string | null; project_id?: string | null }

/**
 * Aplica as tarefas sugeridas pela IA:
 *  - "avulsa": vira tarefa no kanban de Tarefas, sem cliente;
 *  - "projeto": vira tarefa vinculada ao cliente escolhido.
 * Body: { create: Item[], ignore: string[] }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const create: Item[] = Array.isArray(body.create) ? body.create : []
    const ignore: string[] = Array.isArray(body.ignore) ? body.ignore : []
    const supabase = createAdminClient()

    const { data: suggestions, error } = await supabase.from("meeting_tasks").select("*").eq("meeting_id", id).eq("status", "sugerida")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const byId = new Map((suggestions ?? []).map((s) => [s.id, s]))

    for (const item of create) {
      const scope = item.scope === "projeto" ? "projeto" : "avulsa"
      if (scope === "projeto" && !item.client_id) return NextResponse.json({ error: "Tarefas de projeto precisam de um cliente." }, { status: 400 })
    }

    const createdBy = await currentProfileId()

    let created = 0
    for (const item of create) {
      const s = byId.get(item.id)
      if (!s) continue
      const scope = item.scope === "projeto" ? "projeto" : "avulsa"
      // Tarefa de projeto: cliente obrigatório e projeto opcional (validado: precisa ser do mesmo cliente).
      const links = scope === "projeto" ? await resolveTaskLinks(item.client_id, item.project_id) : { error: null, clientId: null, projectId: null, companyName: null }
      if (links.error) return NextResponse.json({ error: links.error, created }, { status: 400 })
      const clientId = links.clientId
      const title = (item.title ?? s.title).trim()
      const description = (item.description ?? s.description ?? "").trim() || title
      const priority = ["baixa", "media", "alta"].includes(item.priority ?? "") ? item.priority : s.priority
      const due = item.due_date !== undefined ? item.due_date || null : s.due_date

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          kind: "tarefa",
          source: "interno",
          title,
          description,
          priority,
          status: "a_fazer",
          due_date: due,
          client_id: clientId,
          company_name: links.companyName,
          ...(links.projectId ? { project_id: links.projectId } : {}),
          meeting_id: id,
          created_by: createdBy,
        })
        .select("id")
        .single()
      if (taskError) return NextResponse.json({ error: `Erro ao criar “${title}”: ${taskError.message}`, created }, { status: 500 })

      await supabase.from("meeting_tasks").update({ status: "criada", task_id: task.id, title, description, priority, due_date: due, scope, client_id: clientId }).eq("id", s.id)
      created++
    }

    if (ignore.length) await supabase.from("meeting_tasks").update({ status: "ignorada" }).eq("meeting_id", id).in("id", ignore)
    return NextResponse.json({ created, ignored: ignore.length })
  } catch (error) {
    console.error("[meet] apply tasks error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
