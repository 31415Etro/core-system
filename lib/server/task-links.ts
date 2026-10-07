import { createAdminClient } from "@/lib/supabase/server"

/**
 * Valida e resolve o vínculo cliente/projeto de uma tarefa.
 * - projeto informado sem cliente: usa o cliente do projeto;
 * - projeto de outro cliente: erro.
 * Devolve também o nome do cliente (gravado em company_name, mostrado no kanban).
 */
export async function resolveTaskLinks(clientId: string | null | undefined, projectId: string | null | undefined) {
  const supabase = createAdminClient()
  let client = clientId || null
  const project = projectId || null
  if (project) {
    const { data } = await supabase.from("projects").select("client_id").eq("id", project).maybeSingle()
    if (!data) return { error: "Projeto não encontrado." }
    if (client && client !== data.client_id) return { error: "Este projeto pertence a outro cliente." }
    client = data.client_id
  }
  let companyName: string | null = null
  if (client) {
    const { data } = await supabase.from("clients").select("name").eq("id", client).maybeSingle()
    if (!data) return { error: "Cliente não encontrado." }
    companyName = data.name
  }
  return { error: null, clientId: client, projectId: project, companyName }
}
