import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { uploadTaskPhoto } from "@/lib/storage"

const REQUEST_TYPES = ["nova_funcionalidade", "manutencao", "nova_pagina"] as const
type RequestType = (typeof REQUEST_TYPES)[number]

const ESTIMATED_WINDOW: Record<RequestType, string> = {
  nova_funcionalidade: "1 a 3 dias úteis · gera custo adicional que será enviado na próxima fatura",
  manutencao: "Correção conforme severidade · queda de banco de dados é corrigida em até 24 horas",
  nova_pagina: "3 a 4 dias úteis",
}

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_PHOTO_BYTES = 4 * 1024 * 1024
const MAX_PHOTOS = 5
const MAX_SUBMISSIONS_PER_HOUR = 10

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const supabase = createAdminClient()

    const clientId = String(formData.get("client_id") || "").trim()
    const requesterName = String(formData.get("requester_name") || "").trim()
    const companyName = String(formData.get("company_name") || "").trim()
    const requestType = String(formData.get("request_type") || "").trim() as RequestType
    const description = String(formData.get("description") || "").trim()
    const costAcknowledgedRaw = formData.get("cost_acknowledged")
    const photos = formData.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0)

    if (!clientId) return NextResponse.json({ error: "Selecione um cliente" }, { status: 400 })
    if (!requesterName) return NextResponse.json({ error: "Informe o nome do autor do chamado" }, { status: 400 })
    if (!companyName) return NextResponse.json({ error: "Informe a empresa" }, { status: 400 })
    if (!REQUEST_TYPES.includes(requestType)) return NextResponse.json({ error: "Tipo de chamado inválido" }, { status: 400 })
    if (!description) return NextResponse.json({ error: "Descreva o chamado" }, { status: 400 })

    let costAcknowledged: boolean | null = null
    if (requestType === "nova_funcionalidade") {
      if (costAcknowledgedRaw !== "true" && costAcknowledgedRaw !== "false") {
        return NextResponse.json({ error: "Confirme se tem ciência do custo adicional" }, { status: 400 })
      }
      costAcknowledged = costAcknowledgedRaw === "true"
    }

    if (photos.length < 1 || photos.length > MAX_PHOTOS) {
      return NextResponse.json({ error: `Envie de 1 a ${MAX_PHOTOS} fotos` }, { status: 400 })
    }
    for (const photo of photos) {
      if (!ALLOWED_MIME_TYPES.has(photo.type)) {
        return NextResponse.json({ error: "As fotos devem ser JPG, PNG ou WEBP" }, { status: 400 })
      }
      if (photo.size > MAX_PHOTO_BYTES) {
        return NextResponse.json({ error: "Cada foto deve ter até 4MB" }, { status: 400 })
      }
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("status", "active")
      .maybeSingle()
    if (clientError || !client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 400 })

    const ip = getClientIp(request)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentSubmissions } = await supabase
      .from("public_submission_log")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", oneHourAgo)
    if ((recentSubmissions ?? 0) >= MAX_SUBMISSIONS_PER_HOUR) {
      return NextResponse.json({ error: "Muitas solicitações. Tente novamente mais tarde." }, { status: 429 })
    }

    const { data: task, error: insertError } = await supabase
      .from("tasks")
      .insert({
        kind: "chamado",
        source: "publico",
        status: "triagem",
        client_id: clientId,
        company_name: companyName,
        requester_name: requesterName,
        request_type: requestType,
        cost_acknowledged: costAcknowledged,
        estimated_window: ESTIMATED_WINDOW[requestType],
        title: `${companyName} · ${requestType === "manutencao" ? "Manutenção" : requestType === "nova_pagina" ? "Nova página" : "Nova funcionalidade"}`,
        description,
      })
      .select("id, os_number")
      .single()

    if (insertError || !task) {
      console.error("[v0] Error creating public task:", insertError)
      return NextResponse.json({ error: "Não foi possível abrir o chamado" }, { status: 500 })
    }

    const uploaded = await Promise.all(photos.map(photo => uploadTaskPhoto(task.id, photo)))
    const { error: attachmentsError } = await supabase
      .from("task_attachments")
      .insert(uploaded.map(item => ({ ...item, task_id: task.id })))
    if (attachmentsError) console.error("[v0] Error saving task attachments:", attachmentsError)

    await supabase.from("public_submission_log").insert({ ip })

    return NextResponse.json({ task_id: task.id, os_number: task.os_number }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating public task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
