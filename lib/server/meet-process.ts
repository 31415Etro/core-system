import { createAdminClient } from "@/lib/supabase/server"
import { analyzeMeeting, transcribeAudio, transcriptionEnabled, type MeetingAnalysis, type TranscriptSegment } from "@/lib/server/meet-ai"

export const MEET_AUDIO_BUCKET = "reunioes-audio"
export const MEET_VIDEO_BUCKET = "reunioes-video"
export const bucketForTrack = (track: string) => (track === "video" ? MEET_VIDEO_BUCKET : MEET_AUDIO_BUCKET)

const tz = "America/Sao_Paulo"
const PARTICIPANT = "Participante"

type Part = { track: "mic" | "tab"; part_index: number; path: string; start_offset_seconds: number }
type Line = { start: number; end: number; speaker: string; text: string }

const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

const words = (t: string) => new Set(t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]{3,}/g) ?? [])
function similar(a: string, b: string) {
  const A = words(a), B = words(b)
  if (!A.size || !B.size) return false
  let common = 0
  for (const w of A) if (B.has(w)) common++
  // Eco = praticamente a mesma fala nas duas faixas; usar o maior conjunto evita apagar perguntas curtas parecidas.
  return common / Math.max(A.size, B.size) >= 0.6
}

/**
 * Junta as duas faixas em uma transcrição única, em ordem de tempo.
 * Remove do microfone o "eco" do alto-falante (mesma fala captada pelas duas faixas).
 */
export function mergeTracks(mic: TranscriptSegment[], tab: TranscriptSegment[], hostName: string) {
  const cleanMic = mic.filter((m) => !tab.some((t) => Math.abs(t.start - m.start) < 4 && similar(t.text, m.text)))
  const lines: Line[] = [
    ...cleanMic.map((s) => ({ ...s, speaker: hostName })),
    ...tab.map((s) => ({ ...s, speaker: PARTICIPANT })),
  ].sort((a, b) => a.start - b.start)

  const merged: Line[] = []
  for (const l of lines) {
    const prev = merged[merged.length - 1]
    if (prev && prev.speaker === l.speaker && l.start - prev.end < 2.5) { prev.text += ` ${l.text}`; prev.end = l.end }
    else merged.push({ ...l })
  }
  return merged.map((l) => `[${clock(l.start)}] ${l.speaker}: ${l.text}`).join("\n")
}

async function transcribeMeeting(meetingId: string, hostName: string, contextHint: string) {
  const supabase = createAdminClient()
  const { data: parts, error } = await supabase.from("meeting_audio_parts").select("track, part_index, path, start_offset_seconds").eq("meeting_id", meetingId).in("track", ["mic", "tab"]).order("part_index")
  if (error) throw new Error("Não foi possível ler as partes do áudio.")
  if (!parts?.length) throw new Error("Nenhum áudio foi recebido desta reunião. Verifique se a extensão conseguiu enviar a gravação.")
  if (!transcriptionEnabled()) throw new Error("Transcrição não configurada no servidor: defina TRANSCRIPTION_BASE_URL (Whisper local) no .env.")

  const mic: TranscriptSegment[] = [], tab: TranscriptSegment[] = []
  for (const part of parts as Part[]) {
    const { data: file, error: dlError } = await supabase.storage.from(MEET_AUDIO_BUCKET).download(part.path)
    if (dlError || !file) continue // parte que falhou no envio: segue com as demais
    const segments = await transcribeAudio(file, part.path.split("/").pop() || "parte.webm", contextHint)
    const offset = Number(part.start_offset_seconds) || 0
    ;(part.track === "mic" ? mic : tab).push(...segments.map((s) => ({ ...s, start: s.start + offset, end: s.end + offset })))
  }
  return mergeTracks(mic, tab, hostName)
}

const EARLY_LEAD_STAGES = ["novo_lead", "contato_realizado", "reuniao_agendada", "prospeccao", "qualificacao"]

/**
 * Processa uma reunião encerrada: transcreve o áudio (Whisper local, gratuito) e só então passa para a IA.
 * Reprocessar reaproveita a transcrição já feita (economiza a cota gratuita), a menos que retranscribe = true.
 */
export async function processMeeting(meetingId: string, { retranscribe = false } = {}) {
  const supabase = createAdminClient()
  await supabase.from("meetings").update({ status: "processando", error: null }).eq("id", meetingId)

  try {
    const { data: meeting, error } = await supabase
      .from("meetings")
      .select("*, client:clients(id, name), lead:commercial_opportunities(id, company_name, stage, contact_name), host:profiles!created_by(full_name)")
      .eq("id", meetingId)
      .single()
    if (error || !meeting) throw new Error("Reunião não encontrada.")

    const hostName: string = meeting.host?.full_name || "Anfitrião"
    const linked = meeting.client?.name || meeting.lead?.company_name || ""

    // 1) Transcrição do áudio (só se ainda não existe ou se pediram de novo)
    let transcript: string = meeting.transcript ?? ""
    if (!transcript || retranscribe) {
      // Dica para o Whisper: nomes e termos que ele costuma errar.
      const hint = [`Reunião em português do Brasil`, linked && `com ${linked}`, meeting.lead?.contact_name && `(${meeting.lead.contact_name})`, `Anfitrião: ${hostName}.`, "Termos: WhatsApp, PMOC, ordem de serviço, CNPJ, CORE, Google Meet, proposta, implantação."].filter(Boolean).join(" ")
      transcript = await transcribeMeeting(meetingId, hostName, hint)
      await supabase.from("meetings").update({ transcript, transcript_source: "whisper" }).eq("id", meetingId)
    }
    if (transcript.trim().length < 40) throw new Error("Quase nenhuma fala foi reconhecida no áudio. Confira se o microfone e o som da reunião foram gravados.")

    // 2) IA
    const context = [
      meeting.client?.name && `Cliente: ${meeting.client.name}`,
      meeting.lead?.company_name && `Lead: ${meeting.lead.company_name}${meeting.lead.contact_name ? ` (contato: ${meeting.lead.contact_name})` : ""}`,
      `Anfitrião (falas do microfone): ${hostName}`,
    ].filter(Boolean).join("\n")
    const meetingDate = new Date(meeting.started_at).toLocaleDateString("pt-BR", { timeZone: tz, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
    const { analysis, model, inputTokens, outputTokens } = await analyzeMeeting({ type: meeting.type, title: meeting.title, transcript, meetingDate, context })

    // 3) Salva a ata
    const participants = [...new Set([hostName, ...analysis.participants].map((p) => p.trim()).filter((p) => p && p !== PARTICIPANT))]
    await supabase.from("meetings").update({
      status: "concluida",
      title: meeting.title?.startsWith("Reunião ") || !meeting.title ? analysis.title : meeting.title,
      summary: analysis.summary,
      minutes: { topics: analysis.topics, decisions: analysis.decisions, open_questions: analysis.open_questions },
      next_meeting: analysis.next_meeting,
      next_steps: analysis.next_steps,
      lead_insights: meeting.type === "interna" ? null : analysis.lead_insights,
      participants,
      ai_model: model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      processed_at: new Date().toISOString(),
      error: null,
    }).eq("id", meetingId)

    // 4) Tarefas sugeridas e pendências (substitui só o que ainda não foi aplicado)
    await supabase.from("meeting_tasks").delete().eq("meeting_id", meetingId).eq("status", "sugerida")
    if (analysis.tasks.length) {
      await supabase.from("meeting_tasks").insert(analysis.tasks.map((t) => ({
        meeting_id: meetingId,
        title: t.title,
        description: t.description || null,
        owner: t.owner || null,
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null,
        priority: t.priority,
        // Reunião com cliente: sugere como tarefa de projeto já vinculada ao cliente.
        scope: meeting.type === "cliente" && meeting.client_id ? "projeto" : "avulsa",
        client_id: meeting.type === "cliente" ? meeting.client_id : null,
      })))
    }
    await supabase.from("meeting_pending").delete().eq("meeting_id", meetingId).eq("done", false)
    if (analysis.pending.length) {
      await supabase.from("meeting_pending").insert(analysis.pending.map((p) => ({ meeting_id: meetingId, side: p.side, description: p.description, owner: p.owner || null })))
    }

    // 5) Reunião com lead: registra tudo dentro do lead
    if (meeting.type === "lead" && meeting.lead_id) await applyToLead(meeting.lead_id, meeting.lead?.stage ?? null, meetingId, analysis, meeting.created_by)

    return { ok: true as const }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar a reunião."
    console.error("[meet] process error:", message)
    await supabase.from("meetings").update({ status: "erro", error: message }).eq("id", meetingId)
    return { ok: false as const, error: message }
  }
}

async function applyToLead(leadId: string, stage: string | null, meetingId: string, a: MeetingAnalysis, createdBy: string | null) {
  const supabase = createAdminClient()
  const bullet = (title: string, items: string[]) => (items.length ? `\n\n${title}:\n${items.map((i) => `• ${i}`).join("\n")}` : "")
  const next = a.next_meeting.scheduled
    ? `\n\nPróxima reunião: ${[a.next_meeting.date && new Date(`${a.next_meeting.date}T12:00:00`).toLocaleDateString("pt-BR"), a.next_meeting.time].filter(Boolean).join(" às ") || "a definir"}${a.next_meeting.agenda ? ` — ${a.next_meeting.agenda}` : ""}`
    : ""
  const description = `${a.summary}${bullet("Decisões", a.decisions)}${bullet("Necessidades", a.lead_insights.requirements)}${bullet("Dores", a.lead_insights.pain_points)}${a.lead_insights.budget ? `\n\nOrçamento: ${a.lead_insights.budget}` : ""}${bullet("Próximos passos", a.next_steps)}${next}`

  // Uma única atividade "Reunião" por reunião (reprocessar atualiza em vez de duplicar).
  const marker = `[reuniao:${meetingId}]`
  await supabase.from("lead_activities").delete().eq("opportunity_id", leadId).like("description", `%${marker}%`)
  await supabase.from("lead_activities").insert({ opportunity_id: leadId, kind: "meeting", description: `${description}\n\n${marker}`, created_by: createdBy })

  const update: Record<string, unknown> = {}
  if (a.next_meeting.scheduled && /^\d{4}-\d{2}-\d{2}$/.test(a.next_meeting.date)) {
    update.next_action = `Reunião${a.next_meeting.agenda ? `: ${a.next_meeting.agenda}` : ""}`.slice(0, 200)
    update.next_action_at = a.next_meeting.date
  } else if (a.next_steps[0]) {
    update.next_action = a.next_steps[0].slice(0, 200)
  }
  // Reunião aconteceu: avança o lead que ainda estava antes dessa etapa.
  if (stage && EARLY_LEAD_STAGES.includes(stage)) update.stage = "reuniao_realizada"
  if (Object.keys(update).length) {
    const { error } = await supabase.from("commercial_opportunities").update(update).eq("id", leadId)
    // Antes da migration 219 a etapa nova não existe: aplica o restante mesmo assim.
    if (error && update.stage) { delete update.stage; await supabase.from("commercial_opportunities").update(update).eq("id", leadId) }
  }
}
