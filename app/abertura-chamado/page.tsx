"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { AlertTriangle, CheckCircle2, ImagePlus, Loader2, Mic, ShieldQuestion, Square, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type RequestType = "nova_funcionalidade" | "manutencao" | "nova_pagina"
type PublicClient = { id: string; name: string }

const MAX_PHOTOS = 5
const MAX_PHOTO_BYTES = 4 * 1024 * 1024

const REQUEST_TYPE_INFO: Record<RequestType, { label: string; description: string }> = {
  nova_funcionalidade: {
    label: "Nova funcionalidade",
    description: "Prazo estimado de 1 a 3 dias úteis.",
  },
  manutencao: {
    label: "Manutenção",
    description:
      "Manutenção é tudo que se enquadra em correção de funcionalidade com defeito e atualização de banco de dados. Em caso de queda de banco, a correção é feita em até 24 horas. Todo chamado de manutenção entra automaticamente com prioridade alta.",
  },
  nova_pagina: {
    label: "Nova página",
    description: "Prazo estimado de 3 a 4 dias úteis.",
  },
}

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
  const [clients, setClients] = useState<PublicClient[]>([])
  const [clientId, setClientId] = useState("")
  const [requesterName, setRequesterName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [requestType, setRequestType] = useState<RequestType | "">("")
  const [costAcknowledged, setCostAcknowledged] = useState<"true" | "false" | "">("")
  const [description, setDescription] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [result, setResult] = useState<{ os_number: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deletionOpen, setDeletionOpen] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)
  const audio = useAudioRecorder()

  useEffect(() => {
    fetch("/api/public/clients")
      .then(response => response.json())
      .then(payload => setClients(payload.clients ?? []))
      .catch(() => setErrorMsg("Não foi possível carregar a lista de clientes."))
  }, [])

  const selectedClient = useMemo(() => clients.find(c => c.id === clientId) ?? null, [clients, clientId])

  useEffect(() => {
    if (selectedClient && !companyName) setCompanyName(selectedClient.name)
  }, [selectedClient]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    setPhotos(current => [...current, ...files].slice(0, MAX_PHOTOS))
    event.target.value = ""
  }

  function removePhoto(index: number) {
    setPhotos(current => current.filter((_, i) => i !== index))
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

  const hasContent = description.trim().length > 0 || Boolean(audio.audioBlob)
  const canSubmit =
    clientId &&
    requesterName.trim() &&
    companyName.trim() &&
    requestType &&
    hasContent &&
    !audio.recording &&
    photos.length >= 1 &&
    photos.length <= MAX_PHOTOS &&
    (requestType !== "nova_funcionalidade" || costAcknowledged !== "")

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
      const formData = new FormData()
      formData.set("client_id", clientId)
      formData.set("requester_name", requesterName.trim())
      formData.set("company_name", companyName.trim())
      formData.set("request_type", requestType)
      formData.set("description", description.trim())
      if (audio.transcript.trim()) formData.set("audio_transcript", audio.transcript.trim())
      if (requestType === "nova_funcionalidade") formData.set("cost_acknowledged", costAcknowledged)
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
        <CheckCircle2 className="h-12 w-12 text-green-600" />
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
        <div>
          <Label>Cliente</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
            <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Seu nome</Label>
            <Input className="mt-1" value={requesterName} onChange={e => setRequesterName(e.target.value)} placeholder="Nome de quem está abrindo o chamado" />
          </div>
          <div>
            <Label>Empresa</Label>
            <Input className="mt-1" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Nome da empresa" />
          </div>
        </div>

        <div>
          <Label>Tipo de chamado</Label>
          <Select value={requestType} onValueChange={value => { setRequestType(value as RequestType); setCostAcknowledged("") }}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
            <SelectContent>
              {Object.entries(REQUEST_TYPE_INFO).map(([value, info]) => <SelectItem key={value} value={value}>{info.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {requestType && (
            <div className="mt-2 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{REQUEST_TYPE_INFO[requestType].description}</p>
            </div>
          )}
        </div>

        {requestType === "nova_funcionalidade" && (
          <div>
            <Label>Você tem ciência de que esta funcionalidade gera custo adicional, cobrado na próxima fatura?</Label>
            <RadioGroup className="mt-2 flex gap-6" value={costAcknowledged} onValueChange={v => setCostAcknowledged(v as "true" | "false")}>
              <div className="flex items-center gap-2"><RadioGroupItem value="true" id="cost-yes" /><Label htmlFor="cost-yes">Sim</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="false" id="cost-no" /><Label htmlFor="cost-no">Não</Label></div>
            </RadioGroup>
          </div>
        )}

        <div>
          <Label>Descrição</Label>
          <Textarea className="mt-1" rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o problema ou o que precisa ser feito (ou grave um áudio abaixo)" />
        </div>

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
            {recordError && <p className="mt-2 text-sm text-red-700">{recordError}</p>}
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
                  <span className="truncate">{photo.name} {photo.size > MAX_PHOTO_BYTES && <span className="text-red-600">(acima de 4MB)</span>}</span>
                  <button type="button" onClick={() => removePhoto(index)} aria-label="Remover foto"><X className="h-4 w-4 text-muted-foreground" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {errorMsg && <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</p>}

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
