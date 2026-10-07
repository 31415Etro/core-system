import { authenticateExtension, extJson, extOptions } from "@/lib/server/meet-auth"
import { createAdminClient } from "@/lib/supabase/server"

export const OPTIONS = extOptions

/** Clientes ou leads cadastrados na CORE, para o seletor da extensão. */
export async function GET(request: Request) {
  const auth = await authenticateExtension(request)
  if (auth instanceof Response) return auth

  const type = new URL(request.url).searchParams.get("type")
  const supabase = createAdminClient()

  if (type === "cliente") {
    const { data, error } = await supabase.from("clients").select("id, name, legal_name").eq("status", "active").order("name")
    if (error) return extJson({ error: error.message }, { status: 500 })
    return extJson({ items: (data ?? []).map((c) => ({ id: c.id, name: c.name, detail: c.legal_name })) })
  }

  if (type === "lead") {
    const { data, error } = await supabase.from("commercial_opportunities").select("id, company_name, contact_name, stage, archived_at").order("company_name")
    // Antes da migration 219 não existe archived_at: tenta sem a coluna.
    const rows = error
      ? (await supabase.from("commercial_opportunities").select("id, company_name, contact_name, stage").order("company_name")).data
      : (data ?? []).filter((l) => !l.archived_at)
    return extJson({ items: (rows ?? []).filter((l) => !["perdido", "fechado", "ganho"].includes(l.stage)).map((l) => ({ id: l.id, name: l.company_name, detail: l.contact_name })) })
  }

  return extJson({ error: "Informe type=cliente ou type=lead." }, { status: 400 })
}
