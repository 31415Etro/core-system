"use client"

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { AlertTriangle, CheckCircle2, ImagePlus, Loader2, Mic, ShieldQuestion, Square, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

type RequestType = "nova_funcionalidade" | "manutencao" | "nova_pagina" | "ajuste"

const MAINTENANCE_RULE = "Manutenção é tudo que tem como objetivo corrigir uma falha, erro ou indisponibilidade e devolver o sistema ao funcionamento que já havia sido contratado ou implementado. Não inclui melhorias, mudanças de preferência ou novas funcionalidades."

const MAINTENANCE_CHECKLIST: Array<{ category: string; items: string[] }> = [
  { category: "Correção de bugs e erros", items: [
    "Botão que parou de funcionar.", "Página que não abre.", "Tela que apresenta erro.", "Formulário que não envia informações.",
    "Campo que não salva os dados.", "Sistema apresentando mensagens de erro inesperadas.", "Função que funcionava anteriormente e deixou de funcionar.",
    "Cálculo automático apresentando resultado incorreto.", "Filtros que não retornam os resultados corretamente.", "Pesquisa/busca que deixou de funcionar.",
    "Problemas de paginação.", "Links internos quebrados.",
  ] },
  { category: "Problemas de acesso e autenticação", items: [
    "Usuário não consegue fazer login por falha do sistema.", "Sistema não reconhece usuário ou senha corretamente.", "Recuperação de senha não funciona.",
    "Sessão encerrando indevidamente.", "Usuários sendo deslogados sem motivo.", "Permissões existentes deixando de funcionar.",
    "Perfil com acesso incorreto devido a erro do sistema.",
  ] },
  { category: "Banco de dados", items: [
    "Banco de dados indisponível.", "Sistema não consegue consultar o banco.", "Sistema não consegue gravar informações.",
    "Dados que deveriam estar sendo salvos e não estão.", "Registros duplicados gerados por erro.", "Dados desaparecendo por falha técnica.",
    "Relacionamento entre registros quebrado.", "Correção de inconsistências geradas pelo próprio sistema.", "Recuperação de banco após falha.",
    "Correção de consultas que deixaram de funcionar.",
  ] },
  { category: "Servidor e infraestrutura", items: [
    "Sistema fora do ar.", "Servidor indisponível.", "Aplicação não inicializando.", "Serviço necessário para o sistema parou.",
    "Erros de comunicação entre servidor e aplicação.", "Problemas de configuração que causaram indisponibilidade.", "Falhas de armazenamento.",
    "Falhas relacionadas à infraestrutura originalmente configurada.", "Reinicialização ou recuperação de serviços após falha.",
  ] },
  { category: "Integrações existentes", items: [
    "Integração com API deixou de funcionar.", "Webhook existente parou de receber ou enviar dados.", "Integração com WhatsApp deixou de funcionar.",
    "Integração com e-mail deixou de funcionar.", "Integração com sistema de pagamento apresentou erro.", "Integração com ERP/CRM deixou de sincronizar.",
    "Dados deixaram de ser enviados entre dois sistemas.", "Correção de autenticação de uma integração já implantada.",
    "Tratamento de erro em uma integração que já fazia parte da solução.",
  ] },
  { category: "Disparos e automações existentes", items: [
    "E-mail automático que deveria ser enviado e não está sendo.", "Mensagem automática que deixou de ser disparada.", "Automação que não executa mais.",
    "Regra automática existente que está executando incorretamente.", "Notificação que deixou de funcionar.", "Tarefa agendada que não está rodando.",
    "Correção de fluxo automático que apresenta erro.",
  ] },
  { category: "Uploads, arquivos e documentos", items: [
    "Sistema não permite anexar arquivo.", "Arquivo enviado não é salvo.", "Arquivo não pode ser visualizado ou baixado por erro do sistema.",
    "PDF que deveria ser gerado e deixou de ser.", "Relatório que deveria ser exportado e apresenta erro.", "Imagem que deveria aparecer e não carrega.",
  ] },
  { category: "Relatórios e dashboards existentes", items: [
    "Dashboard não carrega.", "Indicador apresenta valor incorreto devido a erro de programação.", "Gráfico existente deixou de funcionar.",
    "Dados não estão sendo atualizados como previsto.", "Relatório existente apresenta erro.", "Exportação para Excel/PDF deixou de funcionar.",
    "Métrica calculada de maneira diferente da regra originalmente implementada.",
  ] },
  { category: "Problemas de interface causados por erro", items: [
    "Layout quebrado.", "Elementos sobrepostos.", "Texto ou botão desaparecendo.", "Menu que não abre.", "Modal que não fecha.",
    "Página que ficou inutilizável.", "Componente desalinhado devido a erro do código.", "Responsividade originalmente implementada que deixou de funcionar.",
    "Página quebrada em celular, tablet ou computador quando anteriormente funcionava.",
  ] },
  { category: "Segurança e estabilidade", items: [
    "Correção de vulnerabilidade identificada no código desenvolvido.", "Correção de falha de autenticação.", "Correção de acesso indevido provocado por erro.",
    "Correção de exposição indevida de informações causada pelo sistema.", "Atualização técnica necessária para corrigir vulnerabilidade crítica.",
    "Correção de erro que provoca travamento ou instabilidade.",
  ] },
  { category: "Performance", items: [
    "Sistema ficou anormalmente lento devido a erro.", "Processo entrando em loop.", "Consulta causando travamento.",
    "Consumo excessivo de recursos provocado por bug.", "Correção de problema técnico que impede o sistema de executar normalmente.",
  ] },
  { category: "Recuperação após falhas", items: [
    "Restaurar dados por falha provocada pelo sistema, quando tecnicamente possível.", "Restaurar funcionamento após queda.", "Recuperar serviço que parou.",
    "Restaurar versão estável após atualização com erro.", "Executar rollback de uma versão defeituosa.",
  ] },
]

const MAX_PHOTOS = 5
const MAX_PHOTO_BYTES = 4 * 1024 * 1024
const COST_ACK_TYPES = new Set<RequestType>(["nova_funcionalidade", "ajuste"])

const REQUEST_TYPE_INFO: Record<RequestType, { label: string; description: string }> = {
  nova_funcionalidade: {
    label: "Nova funcionalidade",
    description: "Prazo estimado de 1 a 3 dias úteis.",
  },
  manutencao: {
    label: "Manutenção",
    description: MAINTENANCE_RULE + " Selecione abaixo o que está acontecendo. Todo chamado de manutenção entra automaticamente com prioridade alta.",
  },
  nova_pagina: {
    label: "Nova página",
    description: "Prazo estimado de 3 a 4 dias úteis.",
  },
  ajuste: {
    label: "Ajuste",
    description: "Alteração pontual em uma página existente. Pode gerar custo adicional cobrado na próxima fatura.",
  },
}

const DEVELOPMENT_NOTICE = "Como o projeto está em desenvolvimento, você tem direito a até 3 ajustes por página sem custo."

const DATA_DELETION_MESSAGE = "Não realizamos exclusão de dados, solicite ao usuário admin do sistema de sua empresa."

function useAudioRecorder() {
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [transcript, setTranscript] = useState("")
  const [speechSupported, setSpeechSupported] = useState(true)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null)
  const finalTranscriptRef = useRef("")

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSpeechSupported(Boolean(SpeechRecognition))
  }, [])

  async function start() {
    setAudioBlob(null)
    setAudioUrl(null)
    setTranscript("")
    finalTranscriptRef.current = ""
    chunksRef.current = []

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    recorder.ondataavailable = event => { if (event.data.size > 0) chunksRef.current.push(event.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
      setAudioBlob(blob)
      setAudioUrl(URL.createObjectURL(blob))
      stream.getTracks().forEach(track => track.stop())
    }
    recorder.start()
    mediaRecorderRef.current = recorder

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.lang = "pt-BR"
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (event: any) => {
        let interim = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript
          if (event.results[i].isFinal) finalTranscriptRef.current += text + " "
          else interim += text
        }
        setTranscript((finalTranscriptRef.current + interim).trim())
      }
      recognition.onerror = () => {}
      recognition.start()
      recognitionRef.current = recognition
    }

    setRecording(true)
  }

  function stop() {
    mediaRecorderRef.current?.stop()
    recognitionRef.current?.stop()
    setRecording(false)
  }

  function reset() {
    setAudioBlob(null)
    setAudioUrl(null)
    setTranscript("")
    finalTranscriptRef.current = ""
  }

  return { recording, audioBlob, audioUrl, transcript, setTranscript, speechSupported, start, stop, reset }
}

export default function AberturaChamadoPage() {
  const [requesterName, setRequesterName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [requestType, setRequestType] = useState<RequestType | "">("")
  const [costAcknowledged, setCostAcknowledged] = useState<"true" | "false" | "">("")
  const [maintenanceSelected, setMaintenanceSelected] = useState<string[]>([])
  const [adjustmentPage, setAdjustmentPage] = useState("")
  const [inDevelopment, setInDevelopment] = useState(false)
  const [developmentNoticeOpen, setDevelopmentNoticeOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [result, setResult] = useState<{ os_number: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deletionOpen, setDeletionOpen] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)
  const audio = useAudioRecorder()

  function handlePhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    setPhotos(current => [...current, ...files].slice(0, MAX_PHOTOS))
    event.target.value = ""
  }

  function removePhoto(index: number) {
    setPhotos(current => current.filter((_, i) => i !== index))
  }

  function toggleMaintenanceItem(item: string, checked: boolean) {
    setMaintenanceSelected(current => checked ? [...current, item] : current.filter(i => i !== item))
  }

  async function toggleRecording() {
    setRecordError(null)
    try {
      if (audio.recording) audio.stop()
      else await audio.start()
    } catch {
      setRecordError("Não foi possível acessar o microfone. Verifique a permissão do navegador.")
    }
  }

  const hasContent = requestType === "manutencao"
    ? maintenanceSelected.length > 0
    : description.trim().length > 0 || Boolean(audio.audioBlob)
  const canSubmit =
    requesterName.trim() &&
    companyName.trim() &&
    requestType &&
    hasContent &&
    !audio.recording &&
    photos.length >= 1 &&
    photos.length <= MAX_PHOTOS &&
    (!COST_ACK_TYPES.has(requestType as RequestType) || costAcknowledged !== "") &&
    (requestType !== "ajuste" || adjustmentPage.trim().length > 0)

  function requestOpenTicket(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setConfirmOpen(true)
  }

  async function confirmAndSubmit() {
    setConfirmOpen(false)
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const finalDescription = requestType === "manutencao"
        ? maintenanceSelected.map(item => `- ${item}`).join("\n")
        : description.trim()

      const formData = new FormData()
      formData.set("requester_name", requesterName.trim())
      formData.set("company_name", companyName.trim())
      formData.set("request_type", requestType)
      formData.set("description", finalDescription)
      if (audio.transcript.trim()) formData.set("audio_transcript", audio.transcript.trim())
      if (COST_ACK_TYPES.has(requestType as RequestType)) formData.set("cost_acknowledged", costAcknowledged)
      if (requestType === "ajuste") {
        formData.set("adjustment_page", adjustmentPage.trim())
        formData.set("in_development", String(inDevelopment))
      }
      if (requestType === "manutencao") formData.set("outage_confirmed", "true")
      photos.forEach(photo => formData.append("photos", photo))
      if (audio.audioBlob) formData.append("audio", audio.audioBlob, "gravacao.webm")

      const response = await fetch("/api/public/tasks", { method: "POST", body: formData })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Não foi possível abrir o chamado")
      setResult({ os_number: payload.os_number })
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Não foi possível abrir o chamado")
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-400" />
        <h1 className="text-2xl font-semibold">Chamado aberto com sucesso</h1>
        <p className="text-muted-foreground">Seu número de OS é</p>
        <p className="text-3xl font-bold tracking-tight">{result.os_number}</p>
        <p className="text-sm text-muted-foreground">Guarde este número para acompanhamento.</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>Abrir outro chamado</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-[100dvh] max-w-2xl space-y-6 p-6">
      <header className="space-y-1 border-b pb-5 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">Abertura de chamado</h1>
        <p className="text-sm text-muted-foreground">Preencha os dados abaixo para abrir um chamado com a Gênes Technology.</p>
      </header>

      <form onSubmit={requestOpenTicket} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Seu nome</Label>
            <Input className="mt-1" value={requesterName} onChange={e => setRequesterName(e.target.value)} placeholder="Nome de quem está abrindo o chamado" />
          </div>
          <div>
            <Label>Empresa</Label>
            <Input className="mt-1" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Digite o nome exato da sua empresa" />
          </div>
        </div>

        <div>
          <Label>Tipo de chamado</Label>
          <Select value={requestType} onValueChange={value => { setRequestType(value as RequestType); setCostAcknowledged(""); setAdjustmentPage(""); setInDevelopment(false); setMaintenanceSelected([]) }}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
            <SelectContent>
              {Object.entries(REQUEST_TYPE_INFO).map(([value, info]) => <SelectItem key={value} value={value}>{info.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {requestType && (
            <div className="mt-2 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{REQUEST_TYPE_INFO[requestType].description}</p>
            </div>
          )}
        </div>

        {requestType === "manutencao" && (
          <div>
            <Label>O que está acontecendo? (marque tudo que se aplica)</Label>
            <div className="mt-1 max-h-96 overflow-y-auto rounded-lg border">
              <Accordion type="multiple" className="px-3">
                {MAINTENANCE_CHECKLIST.map(group => (
                  <AccordionItem key={group.category} value={group.category}>
                    <AccordionTrigger>
                      {group.category}
                      {group.items.some(item => maintenanceSelected.includes(item)) && (
                        <span className="ml-auto mr-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          {group.items.filter(item => maintenanceSelected.includes(item)).length}
                        </span>
                      )}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {group.items.map(item => (
                          <label key={item} className="flex items-start gap-2 text-sm">
                            <Checkbox checked={maintenanceSelected.includes(item)} onCheckedChange={v => toggleMaintenanceItem(item, Boolean(v))} className="mt-0.5" />
                            {item}
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Nenhum item se aplica? Provavelmente não é manutenção — abra um chamado de "Ajuste".</p>
          </div>
        )}

        {requestType === "ajuste" && (
          <div>
            <Label>Qual página do ajuste?</Label>
            <Input className="mt-1" value={adjustmentPage} onChange={e => setAdjustmentPage(e.target.value)} placeholder="Ex.: Página de checkout" />
          </div>
        )}

        {requestType === "ajuste" && (
          <div className="flex items-center gap-2">
            <Checkbox id="in-development" checked={inDevelopment} onCheckedChange={v => { const checked = Boolean(v); setInDevelopment(checked); if (checked) setDevelopmentNoticeOpen(true) }} />
            <Label htmlFor="in-development">Este projeto está em desenvolvimento?</Label>
          </div>
        )}

        {COST_ACK_TYPES.has(requestType as RequestType) && (
          <div>
            <Label>Você tem ciência de que este {requestType === "ajuste" ? "ajuste" : "funcionalidade"} gera custo adicional, cobrado na próxima fatura?</Label>
            <RadioGroup className="mt-2 flex gap-6" value={costAcknowledged} onValueChange={v => setCostAcknowledged(v as "true" | "false")}>
              <div className="flex items-center gap-2"><RadioGroupItem value="true" id="cost-yes" /><Label htmlFor="cost-yes">Sim</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="false" id="cost-no" /><Label htmlFor="cost-no">Não</Label></div>
            </RadioGroup>
          </div>
        )}

        {requestType !== "manutencao" && (
          <div>
            <Label>Descrição</Label>
            <Textarea className="mt-1" rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o problema ou o que precisa ser feito (ou grave um áudio abaixo)" />
          </div>
        )}

        <div>
          <Label>Prefere explicar por áudio?</Label>
          <div className="mt-1 rounded-xl border p-4">
            {!audio.audioUrl ? (
              <Button type="button" variant={audio.recording ? "destructive" : "outline"} onClick={toggleRecording}>
                {audio.recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {audio.recording ? "Parar gravação" : "Gravar áudio"}
              </Button>
            ) : (
              <div className="space-y-3">
                <audio controls src={audio.audioUrl} className="w-full" />
                <div>
                  <Label className="text-xs text-muted-foreground">Transcrição (revise se necessário)</Label>
                  <Textarea className="mt-1" rows={3} value={audio.transcript} onChange={e => audio.setTranscript(e.target.value)} placeholder={audio.speechSupported ? "" : "Transcrição automática não suportada neste navegador — descreva o que você falou"} />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={audio.reset}><Trash2 className="h-4 w-4" />Remover áudio</Button>
              </div>
            )}
            {recordError && <p className="mt-2 text-sm text-red-400">{recordError}</p>}
            {!audio.speechSupported && !audio.audioUrl && <p className="mt-2 text-xs text-muted-foreground">Seu navegador não transcreve automaticamente, mas o áudio é salvo mesmo assim.</p>}
          </div>
        </div>

        <div>
          <Label>Fotos ({photos.length}/{MAX_PHOTOS}) — obrigatório ao menos 1</Label>
          <label className="mt-1 flex cursor-pointer flex-col items-center rounded-xl border border-dashed p-6 text-center hover:bg-muted/40">
            <ImagePlus className="h-6 w-6 text-primary" />
            <span className="mt-2 text-sm font-medium">Adicionar fotos</span>
            <span className="mt-1 text-xs text-muted-foreground">JPG, PNG ou WEBP · até 4MB cada</span>
            <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={photos.length >= MAX_PHOTOS} onChange={handlePhotosChange} />
          </label>
          {photos.length > 0 && (
            <ul className="mt-3 space-y-1">
              {photos.map((photo, index) => (
                <li key={`${photo.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                  <span className="truncate">{photo.name} {photo.size > MAX_PHOTO_BYTES && <span className="text-red-400">(acima de 4MB)</span>}</span>
                  <button type="button" onClick={() => removePhoto(index)} aria-label="Remover foto"><X className="h-4 w-4 text-muted-foreground" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {errorMsg && <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{errorMsg}</p>}

        <Button type="submit" className="w-full" disabled={!canSubmit || submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Abrir chamado
        </Button>
      </form>

      <footer className="border-t pt-4 text-center">
        <button type="button" onClick={() => setDeletionOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline">
          <ShieldQuestion className="h-3.5 w-3.5" />Exclusão de dados
        </button>
      </footer>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirme antes de enviar</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que sua descrição de alteração ou manutenção está correta e com imagens?</p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Não, quero ajustar</Button>
            <Button onClick={confirmAndSubmit}>Sim, abrir chamado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={developmentNoticeOpen} onOpenChange={setDevelopmentNoticeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Projeto em desenvolvimento</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{DEVELOPMENT_NOTICE}</p>
          <DialogFooter className="sm:justify-end"><Button onClick={() => setDevelopmentNoticeOpen(false)}>Entendi</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletionOpen} onOpenChange={setDeletionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Exclusão de dados</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{DATA_DELETION_MESSAGE}</p>
          <DialogFooter className="sm:justify-end"><Button onClick={() => setDeletionOpen(false)}>Entendi</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
