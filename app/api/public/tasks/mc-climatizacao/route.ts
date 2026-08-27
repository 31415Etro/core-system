import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { uploadTaskAudio, uploadTaskPhoto } from "@/lib/storage"

// Portal dedicado de chamados de "Ajuste" da MC Climatização: o time deles cola aqui o
// código do componente/página que o próprio sistema exibe, para localizar exatamente
// onde mexer no código sem precisar de uma lista de páginas mantida à mão.
const MC_CLIENT_ID = "2f5ee105-1854-49bc-9f26-efab7ca25dcf"
const MC_COMPANY_NAME = "MC Climatização"

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
    const componentCode = String(formData.get("component_code") || "").trim()
    let description = String(formData.get("description") || "").trim()
    const audioTranscript = String(formData.get("audio_transcript") || "").trim()
    const costAcknowledgedRaw = formData.get("cost_acknowledged")
    const inDevelopment = formData.get("in_development") === "true"
    const photos = formData.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0)
    const audioFile = formData.get("audio")
    const audio = audioFile instanceof File && audioFile.size > 0 ? audioFile : null

    if (!requesterName) return NextResponse.json({ error: "Informe o nome do autor do chamado" }, { status: 400 })
    if (!description && audioTranscript) description = audioTranscript
    if (!description) return NextResponse.json({ error: "Descreva o problema (por texto ou áudio)" }, { status: 400 })
    if (audio && audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "O áudio deve ter até 15MB" }, { status: 400 })

    if (costAcknowledgedRaw !== "true" && costAcknowledgedRaw !== "false") {
      return NextResponse.json({ error: "Confirme se tem ciência do custo adicional" }, { status: 400 })
    }
    const costAcknowledged = costAcknowledgedRaw === "true"

    if (photos.length > MAX_PHOTOS) {
      return NextResponse.json({ error: `Envie no máximo ${MAX_PHOTOS} fotos` }, { status: 400 })
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
    if (photoHashes.length > 0) {
      const { data: reusedPhotos } = await supabase.from("task_attachments").select("id").in("content_hash", photoHashes).limit(1)
      if (reusedPhotos && reusedPhotos.length > 0) {
        return NextResponse.json({ error: "Uma das fotos já foi usada em outro chamado. Envie fotos novas do problema atual." }, { status: 400 })
      }
    }

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
        client_id: MC_CLIENT_ID,
        company_name: MC_COMPANY_NAME,
        requester_name: requesterName,
        request_type: "ajuste",
        cost_acknowledged: costAcknowledged,
        estimated_window: "Prazo conforme complexidade · gera custo adicional que será enviado na próxima fatura (gratuito se o projeto estiver em desenvolvimento, até 3 ajustes por página)",
        title: `${MC_COMPANY_NAME} · Ajuste${componentCode ? ` · ${componentCode}` : ""}`,
        description,
        audio_transcript: audioTranscript || null,
        adjustment_page: componentCode || null,
        in_development: inDevelopment,
      })
      .select("id, os_number")
      .single()

    if (insertError || !task) {
      console.error("[v0] Error creating MC Climatização task:", insertError)
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
      client_id: MC_CLIENT_ID,
      company_name: MC_COMPANY_NAME,
      requester_name: requesterName,
      request_type: "ajuste",
      adjustment_page: componentCode || null,
      in_development: inDevelopment,
      cost_acknowledged: costAcknowledged,
      priority: "media",
      status: "triagem",
      title: `${MC_COMPANY_NAME} · Ajuste${componentCode ? ` · ${componentCode}` : ""}`,
      description,
      audio_transcript: audioTranscript || null,
      photos: uploadedPhotos.map(p => ({ file_name: p.file_name, url: p.public_url })),
      audio: uploadedAudio[0] ? { file_name: uploadedAudio[0].file_name, url: uploadedAudio[0].public_url } : null,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ task_id: task.id, os_number: task.os_number }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating MC Climatização task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
