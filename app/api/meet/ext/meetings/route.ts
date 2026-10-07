import { authenticateExtension, extJson, extOptions } from "@/lib/server/meet-auth"
import { createAdminClient } from "@/lib/supabase/server"

export const OPTIONS = extOptions

const TYPES = ["interna", "cliente", "lead"]

/** Inicia uma reunião (chamado quando a gravação começa na extensão). */
export async function POST(request: Request) {
  const auth = await authenticateExtension(request)
  if (auth instanceof Response) return auth

  const body = await request.json().catch(() => ({}))
  const type = TYPES.includes(body.type) ? body.type : null
  if (!type) return extJson({ error: "Tipo de reunião inválido." }, { status: 400 })
  if (type === "cliente" && !body.client_id) return extJson({ error: "Selecione o cliente." }, { status: 400 })
  if (type === "lead" && !body.lead_id) return extJson({ error: "Selecione o lead." }, { status: 400 })

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 160) : `Reunião ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
  const meetUrl = typeof body.meet_url === "string" && /^https:\/\/meet\.google\.com\//.test(body.meet_url) ? body.meet_url.split("?")[0] : null

  const { data, error } = await createAdminClient()
    .from("meetings")
    .insert({
      type,
      title,
      client_id: type === "cliente" ? body.client_id : null,
      lead_id: type === "lead" ? body.lead_id : null,
      meet_url: meetUrl,
      status: "gravando",
      created_by: auth.userId,
      extension_token_id: auth.tokenId,
    })
    .select("id, title")
    .single()

  if (error) {
    console.error("[meet] create meeting:", error.message)
    return extJson({ error: /does not exist|Could not find the table/i.test(error.message) ? "Execute o script 221_core_meet.sql no banco." : "Não foi possível iniciar a reunião." }, { status: 500 })
  }
  return extJson({ meeting: data }, { status: 201 })
}
