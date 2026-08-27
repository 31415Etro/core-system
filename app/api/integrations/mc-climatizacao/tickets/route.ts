import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// Endpoint de integração para o SISTEMA da MC Climatização abrir chamados de "Ajuste"
// diretamente via API (sem formulário). Autenticado por chave própria (header x-api-key),
// gerada e revogável em Configurações > Integrações.
const MC_CLIENT_ID = "2f5ee105-1854-49bc-9f26-efab7ca25dcf"
const MC_COMPANY_NAME = "MC Climatização"

async function checkApiKey(request: Request) {
  const key = request.headers.get("x-api-key")
  if (!key) return false
  const supabase = createAdminClient()
  const { data } = await supabase.from("integration_settings").select("mc_climatizacao_ticket_api_key").eq("id", "default").maybeSingle()
  return Boolean(data?.mc_climatizacao_ticket_api_key) && key === data?.mc_climatizacao_ticket_api_key
}

async function fireChamadoWebhook(request: Request, payload: Record<string, unknown>) {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase.from("integration_settings").select("chamado_webhook_url").eq("id", "default").maybeSingle()
    const url = data?.chamado_webhook_url
    if (!url) return
    const origin = new URL(request.url).origin
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        callback: { update_url: `${origin}/api/agent/tasks/${payload.task_id}`, get_url: `${origin}/api/agent/tasks/${payload.task_id}`, auth_header: "x-api-key" },
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (error) {
    console.error("[v0] Error firing chamado webhook:", error)
  }
}

export async function POST(request: Request) {
  if (!(await checkApiKey(request))) return NextResponse.json({ error: "Chave de API inválida" }, { status: 401 })

  try {
    const body = await request.json()
    const requesterName = String(body.requester_name || "").trim() || "Sistema MC Climatização"
    const componentCode = String(body.component_code || "").trim()
    const description = String(body.description || "").trim()
    const inDevelopment = body.in_development === true

    if (!componentCode) return NextResponse.json({ error: "component_code é obrigatório" }, { status: 400 })
    if (!description) return NextResponse.json({ error: "description é obrigatório" }, { status: 400 })
    if (typeof body.cost_acknowledged !== "boolean") return NextResponse.json({ error: "cost_acknowledged (true/false) é obrigatório" }, { status: 400 })
    const costAcknowledged = body.cost_acknowledged as boolean

    const supabase = createAdminClient()
    const { data: task, error: insertError } = await supabase
      .from("tasks")
      .insert({
        kind: "chamado",
        source: "publico",
        status: "triagem",
        client_id: MC_CLIENT_ID,
        company_name: MC_COMPANY_NAME,
        requester_name: requesterName,
        request_type: "ajuste",
        cost_acknowledged: costAcknowledged,
        estimated_window: "Prazo conforme complexidade · gera custo adicional que será enviado na próxima fatura (gratuito se o projeto estiver em desenvolvimento, até 3 ajustes por página)",
        title: `${MC_COMPANY_NAME} · Ajuste · ${componentCode}`,
        description,
        adjustment_page: componentCode,
        in_development: inDevelopment,
      })
      .select("id, os_number")
      .single()

    if (insertError || !task) {
      console.error("[v0] Error creating MC Climatização task via API:", insertError)
      return NextResponse.json({ error: "Não foi possível abrir o chamado" }, { status: 500 })
    }

    await fireChamadoWebhook(request, {
      event: "chamado.created",
      task_id: task.id,
      os_number: task.os_number,
      client_id: MC_CLIENT_ID,
      company_name: MC_COMPANY_NAME,
      requester_name: requesterName,
      request_type: "ajuste",
      adjustment_page: componentCode,
      in_development: inDevelopment,
      cost_acknowledged: costAcknowledged,
      priority: "media",
      status: "triagem",
      title: `${MC_COMPANY_NAME} · Ajuste · ${componentCode}`,
      description,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ task_id: task.id, os_number: task.os_number }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating MC Climatização task via API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
