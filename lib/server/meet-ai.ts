import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod/v4"

/**
 * IA das reuniões: transforma a transcrição em ata, tarefas, pendências,
 * próxima reunião e informações comerciais — em JSON validado por schema.
 */

// Bom custo-benefício para extração/resumo; troque por claude-opus-5-5 no .env para máxima qualidade.
export const MEET_MODEL = process.env.CORE_AI_MODEL || "claude-sonnet-5-5"

const MeetingAnalysis = z.object({
  title: z.string().describe("Título curto e específico da reunião (até 8 palavras)."),
  summary: z.string().describe("Resumo executivo em 3 a 6 frases: objetivo, o que foi discutido e o resultado."),
  topics: z.array(z.object({ title: z.string(), notes: z.string().describe("O que foi dito sobre o tema, objetivo e factual.") })).describe("Ata: assuntos tratados, na ordem em que apareceram."),
  decisions: z.array(z.string()).describe("Decisões tomadas de fato (não sugestões)."),
  open_questions: z.array(z.string()).describe("Dúvidas ou pontos que ficaram em aberto."),
  participants: z.array(z.string()).describe("Nomes das pessoas que participaram, conforme a transcrição."),
  tasks: z.array(z.object({
    title: z.string().describe("Ação concreta começando com verbo no infinitivo."),
    description: z.string().describe("Contexto suficiente para executar sem ter assistido à reunião."),
    owner: z.string().describe("Quem ficou responsável, se foi dito; senão string vazia."),
    due_date: z.string().describe("Prazo no formato AAAA-MM-DD se foi combinado (resolva datas relativas a partir da data da reunião); senão string vazia."),
    priority: z.enum(["baixa", "media", "alta"]),
  })).describe("Tarefas que a nossa equipe precisa executar."),
  pending: z.array(z.object({
    side: z.enum(["nossa", "cliente"]).describe("nossa = responsabilidade da nossa empresa; cliente = o cliente/lead precisa enviar ou fazer."),
    description: z.string(),
    owner: z.string().describe("Responsável, se citado; senão string vazia."),
  })).describe("Pendências: coisas a enviar, aprovar ou providenciar, separadas por lado."),
  next_meeting: z.object({
    scheduled: z.boolean().describe("true se uma próxima reunião foi combinada ou sugerida."),
    date: z.string().describe("AAAA-MM-DD se definida; senão string vazia."),
    time: z.string().describe("HH:MM se definido; senão string vazia."),
    agenda: z.string().describe("Objetivo/pauta da próxima reunião; vazio se não houver."),
  }),
  next_steps: z.array(z.string()).describe("Próximos passos combinados, em ordem."),
  lead_insights: z.object({
    pain_points: z.array(z.string()),
    requirements: z.array(z.string()).describe("Necessidades/funcionalidades que o cliente quer."),
    budget: z.string().describe("Orçamento, valores ou faixa citados; vazio se não houver."),
    decision_makers: z.array(z.string()),
    objections: z.array(z.string()),
    interest_level: z.enum(["baixo", "medio", "alto", "indefinido"]),
    proposal_items: z.array(z.string()).describe("Itens que devem entrar numa proposta comercial."),
  }).describe("Informações comerciais. Preencha principalmente em reuniões com lead ou cliente; em reuniões internas deixe as listas vazias e interest_level 'indefinido'."),
})

export type MeetingAnalysis = z.infer<typeof MeetingAnalysis>

const SYSTEM = `Você é o assistente de reuniões da CORE, um sistema de gestão de uma empresa de tecnologia.
Você recebe a transcrição automática (Whisper) de uma reunião do Google Meet, com erros de reconhecimento, e produz uma ata fiel e acionável em português do Brasil.

Sobre a transcrição: o áudio foi gravado em duas faixas. As falas com o nome do anfitrião vêm do microfone dele; as marcadas como "Participante" vêm das outras pessoas da chamada (podem ser várias). Quando o contexto deixar claro quem é o participante (ele se apresenta, alguém o chama pelo nome), use o nome na ata; senão, refira-se a ele pelo papel (ex.: "o cliente").

Regras:
- Use apenas o que está na transcrição. Não invente nomes, datas, valores ou compromissos; se algo não foi dito, deixe vazio.
- Corrija erros óbvios de reconhecimento de fala pelo contexto, sem mudar o sentido.
- Tarefas são ações da nossa equipe; o que o cliente/lead precisa enviar ou fazer vai em pendências do lado "cliente".
- Seja específico: "Enviar proposta com módulo de PMOC até sexta" é melhor que "Enviar proposta".
- Resolva datas relativas ("sexta que vem", "dia 15") a partir da data da reunião informada.
- Se a transcrição for curta ou sem conteúdo útil, diga isso no resumo e devolva listas vazias.`

const TYPE_LABEL = { interna: "reunião interna da equipe", cliente: "reunião com cliente", lead: "reunião comercial com lead (potencial cliente)" } as const

export async function analyzeMeeting(input: {
  type: keyof typeof TYPE_LABEL
  title: string
  transcript: string
  meetingDate: string
  context?: string
}): Promise<{ analysis: MeetingAnalysis; model: string; inputTokens: number; outputTokens: number }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada no servidor.")
  const client = new Anthropic()

  const userContent = [
    `Tipo: ${TYPE_LABEL[input.type]}`,
    `Título informado: ${input.title}`,
    `Data da reunião: ${input.meetingDate}`,
    input.context ? `Contexto do sistema:\n${input.context}` : "",
    `<transcricao>\n${input.transcript}\n</transcricao>`,
  ].filter(Boolean).join("\n\n")

  const response = await client.beta.messages.parse({
    model: MEET_MODEL,
    max_tokens: 16000,
    // Extração/resumo não precisa de raciocínio longo: esforço médio mantém a qualidade e reduz custo.
    output_config: { effort: "medium", format: zodOutputFormat(MeetingAnalysis) },
    // Se a IA recusar por política, a própria API reexecuta num modelo de fallback.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content: userContent }],
  })

  if (response.stop_reason === "refusal") throw new Error("A IA recusou processar esta transcrição.")
  if (response.stop_reason === "max_tokens") throw new Error("A resposta da IA foi cortada (reunião muito longa).")
  if (!response.parsed_output) throw new Error("A IA não devolveu a ata no formato esperado.")

  return {
    analysis: response.parsed_output,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

/**
 * Transcrição gratuita e local do áudio com Whisper (código aberto), via speaches
 * (https://github.com/speaches-ai/speaches) rodando no próprio servidor — sem conta, sem limite, o áudio não sai do servidor.
 * Configure TRANSCRIPTION_BASE_URL (ex.: http://whisper:8000/v1) e TRANSCRIPTION_MODEL.
 */
export const transcriptionEnabled = () => Boolean(process.env.TRANSCRIPTION_BASE_URL)

export type TranscriptSegment = { start: number; end: number; text: string }

// Frases que o Whisper "inventa" em trechos de silêncio.
const HALLUCINATIONS = [/legendas? (pela|por) comunidade/i, /amara\.org/i, /obrigad[oa] por assistir/i, /inscreva-se/i, /^\s*(obrigad[oa]|tchau)[.!]?\s*$/i, /^[\s.…]*$/]

export async function transcribeAudio(audio: Blob, fileName: string, prompt?: string): Promise<TranscriptSegment[]> {
  const base = (process.env.TRANSCRIPTION_BASE_URL || "").replace(/\/$/, "")
  if (!base) throw new Error("Transcrição não configurada (TRANSCRIPTION_BASE_URL).")
  const form = new FormData()
  form.append("file", audio, fileName)
  form.append("model", process.env.TRANSCRIPTION_MODEL || "Systran/faster-whisper-small")
  form.append("language", "pt")
  form.append("temperature", "0")
  form.append("response_format", "verbose_json")
  // Pula trechos de silêncio (a faixa do microfone fica calada boa parte do tempo): mais rápido e sem "alucinações".
  form.append("vad_filter", "true")
  if (prompt) form.append("prompt", prompt.slice(0, 600))

  let response: Response
  try {
    response = await fetch(`${base}/audio/transcriptions`, { method: "POST", body: form })
  } catch {
    throw new Error("O serviço de transcrição (Whisper) não respondeu. Verifique se o container está rodando.")
  }
  if (!response.ok) throw new Error(`Falha na transcrição do áudio (${response.status}): ${(await response.text()).slice(0, 200)}`)
  const payload = (await response.json()) as { text?: string; segments?: { start: number; end: number; text: string; no_speech_prob?: number; avg_logprob?: number }[] }
  const segments = payload.segments ?? (payload.text ? [{ start: 0, end: 0, text: payload.text }] : [])
  return segments
    .filter((s) => (s.no_speech_prob ?? 0) < 0.6 && (s.avg_logprob ?? 0) > -1.2)
    .map((s) => ({ start: s.start, end: s.end, text: s.text.trim() }))
    .filter((s) => s.text && !HALLUCINATIONS.some((h) => h.test(s.text)))
}
