// CORE Meet — documento offscreen: grava o SEU microfone e o SOM da reunião em faixas separadas
// e, se ativado, o VÍDEO da aba do Meet (com o áudio misturado), em partes de ~5 min,
// enviando cada parte para a CORE assim que ela fecha.
// Faixas separadas = a transcrição sabe o que foi você ("mic") e o que foram os participantes ("tab").
// O vídeo ("video") é só para assistir depois; não entra na transcrição.

const PART_SECONDS = 300 // 5 min por parte (~1,2 MB por faixa): cada transcrição termina rápido no Whisper do servidor
const BITRATE = 32000 // Opus mono 32 kbps: ótimo para voz
// Vídeo: 720p a 15 fps e ~800 kbps (VP8) ≈ 30 MB por parte, ≈ 360 MB por reunião de 1 hora.
const VIDEO = { mimeType: "video/webm;codecs=vp8,opus", videoBitsPerSecond: 800_000, audioBitsPerSecond: 64_000 }

const recorderOptions = (track) => (track === "video" ? VIDEO : { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: BITRATE })
const blobType = (track) => (track === "video" ? "video/webm" : "audio/webm")

let session = null // { meetingId, baseUrl, token, streams, audioContext, tracks: { mic?, tab }, index, partStartedAt, recordedBefore, paused, pausedAt, uploads, uploaded, failed, rotateTimer, keepAlive }

async function startRecording({ streamId, meetingId, baseUrl, token, video = false }) {
  // 1) Aba do Meet: som dos participantes e, se pedido, a imagem. O streamId só pode ser usado uma vez,
  //    então áudio e vídeo vêm na mesma captura.
  const captured = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
    video: video ? { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId, maxWidth: 1280, maxHeight: 720, maxFrameRate: 15 } } : false,
  })
  const tabStream = new MediaStream(captured.getAudioTracks())
  // Capturar a aba silencia o som dela: devolve para os alto-falantes para você continuar ouvindo a reunião.
  const audioContext = new AudioContext()
  const tabSource = audioContext.createMediaStreamSource(tabStream)
  tabSource.connect(audioContext.destination)

  // 2) Seu microfone (permissão concedida uma vez em permission.html)
  let micStream = null
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  } catch (err) {
    console.warn("[CORE Meet] microfone indisponível:", err?.message)
  }

  // 3) Vídeo: imagem da aba + som da reunião e do seu microfone misturados.
  let videoStream = null
  const videoTrack = captured.getVideoTracks()[0]
  if (videoTrack) {
    const mix = audioContext.createMediaStreamDestination()
    tabSource.connect(mix)
    if (micStream) audioContext.createMediaStreamSource(micStream).connect(mix)
    videoStream = new MediaStream([videoTrack, ...mix.stream.getAudioTracks()])
  }

  session = {
    meetingId, baseUrl, token,
    streams: [captured, micStream].filter(Boolean),
    audioContext,
    sources: { tab: tabStream, ...(micStream ? { mic: micStream } : {}), ...(videoStream ? { video: videoStream } : {}) },
    tracks: {},
    index: 0,
    recordedBefore: 0, // segundos gravados nas partes anteriores (sem contar pausas)
    partStartedAt: Date.now(),
    pausedMs: 0,
    pausedAt: null,
    uploads: Promise.resolve(),
    uploaded: 0,
    failed: 0,
    bytes: 0,
    videoBytes: 0,
  }
  startPart()
  session.rotateTimer = setInterval(rotate, PART_SECONDS * 1000)
  // Mantém o service worker acordado durante a gravação.
  session.keepAlive = setInterval(() => chrome.runtime.sendMessage({ type: "keepalive" }).catch(() => {}), 20_000)
  return { ok: true, micOk: Boolean(micStream), videoOk: Boolean(videoStream) }
}

function startPart() {
  session.partStartedAt = Date.now()
  session.pausedMs = 0
  // Se a troca de parte acontecer durante uma pausa, a pausa passa a contar a partir desta parte.
  if (session.pausedAt) session.pausedAt = session.partStartedAt
  for (const [track, stream] of Object.entries(session.sources)) {
    const recorder = new MediaRecorder(stream, recorderOptions(track))
    const chunks = []
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
    recorder.start(5000)
    if (session.pausedAt) recorder.pause()
    session.tracks[track] = { recorder, chunks }
  }
}

/** Fecha a parte atual (todas as faixas) e agenda o envio. Cada parte é um arquivo .webm independente. */
async function closePart() {
  const index = session.index
  const startOffset = session.recordedBefore
  const now = Date.now()
  const duration = Math.max(0, (now - session.partStartedAt - session.pausedMs - (session.pausedAt ? now - session.pausedAt : 0)) / 1000)
  const finished = await Promise.all(Object.entries(session.tracks).map(([track, { recorder, chunks }]) => new Promise((resolve) => {
    recorder.onstop = () => resolve({ track, blob: new Blob(chunks, { type: blobType(track) }) })
    if (recorder.state !== "inactive") recorder.stop()
    else resolve({ track, blob: new Blob(chunks, { type: blobType(track) }) })
  })))
  session.recordedBefore += duration
  session.index += 1
  for (const { track, blob: raw } of finished) {
    if (!raw.size) continue
    // O MediaRecorder não grava a duração no .webm: sem isso o player não mostra o tempo nem deixa avançar.
    const blob = await window.ysFixWebmDuration(raw, Math.round(duration * 1000), { logger: false }).catch(() => raw)
    // Envios em fila: um de cada vez, sem travar a gravação.
    session.uploads = session.uploads.then(() => uploadPart({ track, index, blob, startOffset, duration }))
  }
}

async function rotate() {
  if (!session) return
  await closePart()
  if (session) startPart()
}

async function uploadPart({ track, index, blob, startOffset, duration }) {
  const { meetingId, baseUrl, token } = session
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const target = await fetch(`${baseUrl}/api/meet/ext/meetings/${meetingId}/upload-url`, { method: "POST", headers, body: JSON.stringify({ track, index }) })
      const info = await target.json().catch(() => ({}))
      if (!target.ok) throw new Error(info.error || "Falha ao preparar o envio.")
      const put = await fetch(info.signed_url, { method: "PUT", headers: { "Content-Type": blobType(track), "x-upsert": "true" }, body: blob })
      if (!put.ok) throw new Error(`Falha ao enviar o áudio (${put.status}).`)
      const reg = await fetch(`${baseUrl}/api/meet/ext/meetings/${meetingId}/parts`, { method: "POST", headers, body: JSON.stringify({ track, index, path: info.path, start_offset: startOffset, duration, bytes: blob.size }) })
      if (!reg.ok) throw new Error("Falha ao registrar a parte.")
      session.uploaded += 1
      if (track === "video") session.videoBytes += blob.size
      else session.bytes += blob.size
      chrome.runtime.sendMessage({ type: "part-uploaded", uploaded: session.uploaded, failed: session.failed }).catch(() => {})
      return
    } catch (err) {
      if (attempt === 3) {
        session.failed += 1
        console.warn("[CORE Meet] parte não enviada:", track, index, err?.message)
        chrome.runtime.sendMessage({ type: "part-uploaded", uploaded: session.uploaded, failed: session.failed }).catch(() => {})
      } else await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
}

function setPaused(paused) {
  if (!session) return
  for (const { recorder } of Object.values(session.tracks)) {
    if (paused && recorder.state === "recording") recorder.pause()
    if (!paused && recorder.state === "paused") recorder.resume()
  }
  if (paused && !session.pausedAt) session.pausedAt = Date.now()
  if (!paused && session.pausedAt) { session.pausedMs += Date.now() - session.pausedAt; session.pausedAt = null }
}

async function stopRecording() {
  if (!session) return { error: "Nenhuma gravação ativa." }
  clearInterval(session.rotateTimer)
  if (session.pausedAt) setPaused(false)
  await closePart()
  await session.uploads // espera todas as partes subirem
  const result = { uploaded: session.uploaded, failed: session.failed, bytes: session.bytes, videoBytes: session.videoBytes }
  clearInterval(session.keepAlive)
  session.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
  session.audioContext.close().catch(() => {})
  session = null
  return result.uploaded ? result : { ...result, error: "Nenhuma parte do áudio foi enviada." }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen") return false
  const run = async () => {
    switch (message.type) {
      case "start-recording": return startRecording(message)
      case "pause-recording": setPaused(true); return { ok: true }
      case "resume-recording": setPaused(false); return { ok: true }
      case "stop-recording": return stopRecording()
      default: return { ok: false }
    }
  }
  run().then(sendResponse, (err) => sendResponse({ ok: false, error: err?.message || String(err) }))
  return true
})
