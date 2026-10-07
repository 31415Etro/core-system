import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { currentProfileId } from "@/lib/server/leads"

const notInstalled = (m: string) => /does not exist|Could not find the table/i.test(m)

/** Projetos (opcional ?client_id=). */
export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get("client_id")
  let query = createAdminClient().from("projects").select("id, client_id, name, status, due_date, client:clients(id, name)").order("name")
  if (clientId) query = query.eq("client_id", clientId)
  const { data, error } = await query
  if (error) {
    const missing = notInstalled(error.message)
    return NextResponse.json({ error: missing ? "Execute o script 223_projects_and_task_links.sql." : error.message, code: missing ? "not_installed" : undefined }, { status: missing ? 503 : 500 })
  }
  return NextResponse.json({ projects: data ?? [] })
}

/** Cria um projeto de um cliente. Body: { client_id, name, description?, due_date? } */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 160) : ""
  if (!body.client_id) return NextResponse.json({ error: "Selecione o cliente do projeto." }, { status: 400 })
  if (!name) return NextResponse.json({ error: "Informe o nome do projeto." }, { status: 400 })
  const { data, error } = await createAdminClient()
    .from("projects")
    .insert({ client_id: body.client_id, name, description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null, due_date: body.due_date || null, created_by: await currentProfileId() })
    .select("id, client_id, name, status, due_date, client:clients(id, name)")
    .single()
  if (error) {
    const dup = /duplicate|unique/i.test(error.message)
    return NextResponse.json({ error: dup ? "Este cliente já tem um projeto com esse nome." : error.message }, { status: dup ? 409 : 500 })
  }
  return NextResponse.json({ project: data }, { status: 201 })
}
