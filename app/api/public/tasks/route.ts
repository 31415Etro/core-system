import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { uploadTaskAudio, uploadTaskPhoto } from "@/lib/storage"

const REQUEST_TYPES = ["nova_funcionalidade", "manutencao", "nova_pagina", "ajuste"] as const
type RequestType = (typeof REQUEST_TYPES)[number]
const COST_ACK_TYPES = new Set<RequestType>(["nova_funcionalidade", "ajuste"])

const ESTIMATED_WINDOW: Record<RequestType, string> = {
  nova_funcionalidade: "1 a 3 dias úteis · gera custo adicional que será enviado na próxima fatura",
  manutencao: "Correção conforme severidade · queda de banco de dados é corrigida em até 24 horas",
  nova_pagina: "3 a 4 dias úteis",
  ajuste: "Prazo conforme complexidade · gera custo adicional que será enviado na próxima fatura (gratuito se o projeto estiver em desenvolvimento, até 3 ajustes por página)",
}

const TITLE_LABEL: Record<RequestType, string> = {
  nova_funcionalidade: "Nova funcionalidade",
  manutencao: "Manutenção",
  nova_pagina: "Nova página",
  ajuste: "Ajuste",
}

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_PHOTO_BYTES = 4 * 1024 * 1024
const MAX_PHOTOS = 5
const MAX_AUDIO_BYTES = 15 * 1024 * 1024
const MAX_SUBMISSIONS_PER_HOUR = 10

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

async function sha256Hex(file: File) {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("")
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
  try {
    const formData = await request.formData()
    const supabase = createAdminClient()

    const requesterName = String(formData.get("requester_name") || "").trim()
    const companyName = String(formData.get("company_name") || "").trim()
    const requestType = String(formData.get("request_type") || "").trim() as RequestType
    let description = String(formData.get("description") || "").trim()
    const audioTranscript = String(formData.get("audio_transcript") || "").trim()
    const costAcknowledgedRaw = formData.get("cost_acknowledged")
    const outageConfirmedRaw = formData.get("outage_confirmed")
    const adjustmentPage = String(formData.get("adjustment_page") || "").trim()
    const inDevelopment = formData.get("in_development") === "true"
    const photos = formData.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0)
    const audioFile = formData.get("audio")
    const audio = audioFile instanceof File && audioFile.size > 0 ? audioFile : null

    if (!requesterName) return NextResponse.json({ error: "Informe o nome do autor do chamado" }, { status: 400 })
    if (!companyName) return NextResponse.json({ error: "Informe a empresa" }, { status: 400 })
    if (!REQUEST_TYPES.includes(requestType)) return NextResponse.json({ error: "Tipo de chamado inválido" }, { status: 400 })
    if (!description && audioTranscript) description = audioTranscript
    if (!description) return NextResponse.json({ error: "Descreva o chamado (por texto ou áudio)" }, { status: 400 })
    if (audio && audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "O áudio deve ter até 15MB" }, { status: 400 })
    if (requestType === "ajuste" && !adjustmentPage) return NextResponse.json({ error: "Informe qual página precisa de ajuste" }, { status: 400 })

    let costAcknowledged: boolean | null = null
    if (COST_ACK_TYPES.has(requestType)) {
      if (costAcknowledgedRaw !== "true" && costAcknowledgedRaw !== "false") {
        return NextResponse.json({ error: "Confirme se tem ciência do custo adicional" }, { status: 400 })
      }
      costAcknowledged = costAcknowledgedRaw === "true"
    }

    let outageConfirmed: boolean | null = null
    if (requestType === "manutencao") {
      if (outageConfirmedRaw !== "true") {
        return NextResponse.json({ error: "Manutenção é só para banco de dados ou sistema fora do ar. Confirme a queda ou abra um chamado de Ajuste." }, { status: 400 })
      }
      outageConfirmed = true
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

    const photoHashes = await Promise.all(photos.map(sha256Hex))
    const { data: reusedPhotos } = await supabase
      .from("task_attachments")
      .select("id")
      .in("content_hash", photoHashes)
      .limit(1)
    if (reusedPhotos && reusedPhotos.length > 0) {
      return NextResponse.json({ error: "Uma das fotos já foi usada em outro chamado. Envie fotos novas do problema atual." }, { status: 400 })
    }

    const normalizedCompany = normalizeName(companyName)
    const { data: activeClients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name, legal_name")
      .eq("status", "active")
    if (clientsError) return NextResponse.json({ error: "Não foi possível validar a empresa" }, { status: 500 })
    const matches = (activeClients ?? []).filter(c => normalizeName(c.name) === normalizedCompany || (c.legal_name && normalizeName(c.legal_name) === normalizedCompany))
    if (matches.length === 0) return NextResponse.json({ error: "Não encontramos uma empresa com esse nome. Verifique a grafia exata ou entre em contato com a Gênes." }, { status: 400 })
    if (matches.length > 1) return NextResponse.json({ error: "Encontramos mais de uma empresa com esse nome. Entre em contato com a Gênes para abrir o chamado." }, { status: 400 })
    const clientId = matches[0].id

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
        title: `${companyName} · ${TITLE_LABEL[requestType]}`,
        description,
        audio_transcript: audioTranscript || null,
        adjustment_page: requestType === "ajuste" ? adjustmentPage : null,
        in_development: requestType === "ajuste" ? inDevelopment : false,
        outage_confirmed: outageConfirmed,
      })
      .select("id, os_number")
      .single()

    if (insertError || !task) {
      console.error("[v0] Error creating public task:", insertError)
      return NextResponse.json({ error: "Não foi possível abrir o chamado" }, { status: 500 })
    }

    const uploadedPhotos = await Promise.all(photos.map((photo, index) => uploadTaskPhoto(task.id, photo).then(item => ({ ...item, content_hash: photoHashes[index] }))))
    const uploadedAudio = audio ? [await uploadTaskAudio(task.id, audio)] : []
    const { error: attachmentsError } = await supabase
      .from("task_attachments")
      .insert([...uploadedPhotos, ...uploadedAudio].map(item => ({ ...item, task_id: task.id })))
    if (attachmentsError) console.error("[v0] Error saving task attachments:", attachmentsError)

    await supabase.from("public_submission_log").insert({ ip })

    await fireChamadoWebhook(request, {
      event: "chamado.created",
      task_id: task.id,
      os_number: task.os_number,
      client_id: clientId,
      company_name: companyName,
      requester_name: requesterName,
      request_type: requestType,
      adjustment_page: requestType === "ajuste" ? adjustmentPage : null,
      in_development: requestType === "ajuste" ? inDevelopment : false,
      cost_acknowledged: costAcknowledged,
      outage_confirmed: outageConfirmed,
      priority: requestType === "manutencao" ? "alta" : "media",
      status: "triagem",
      title: `${companyName} · ${TITLE_LABEL[requestType]}`,
      description,
      audio_transcript: audioTranscript || null,
      estimated_window: ESTIMATED_WINDOW[requestType],
      photos: uploadedPhotos.map(p => ({ file_name: p.file_name, url: p.public_url })),
      audio: uploadedAudio[0] ? { file_name: uploadedAudio[0].file_name, url: uploadedAudio[0].public_url } : null,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ task_id: task.id, os_number: task.os_number }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating public task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
