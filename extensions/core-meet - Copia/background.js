// CORE Meet — service worker: orquestra a gravação (documento offscreen) e conversa com a API da CORE.
import { api, getConfig } from "./api.js"

const OFFSCREEN_URL = "offscreen.html"

// ---------- estado (sobrevive ao service worker dormir) ----------
async function getState() {
  const { recording = null, finished = null } = await chrome.storage.session.get(["recording", "finished"])
  return { recording, finished }
}
const setState = (patch) => chrome.storage.session.set(patch)

function elapsedSeconds(rec) {
  if (!rec) return 0
  const now = Date.now()
  const pausedNow = rec.pausedAt ? now - rec.pausedAt : 0
  return Math.max(0, Math.round((now - rec.startedAt - rec.pausedMs - pausedNow) / 1000))
}

// ---------- offscreen (gravação de áudio) ----------
async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] })
  if (contexts.length) return
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["USER_MEDIA"],
    justification: "Gravar o microfone, o áudio e (opcionalmente) o vídeo da aba do Google Meet para transcrever e arquivar a reunião.",
  })
}

async function closeOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] })
  if (contexts.length) await chrome.offscreen.closeDocument().catch(() => {})
}

const toOffscreen = (message) => chrome.runtime.sendMessage({ target: "offscreen", ...message })

// ---------- ações ----------
async function start({ tabId, meetingType: type, clientId, leadId, linkedName, title, meetUrl, video = false }) {
  const { recording } = await getState()
  if (recording) throw new Error("Já existe uma gravação em andamento.")
  // O id da captura é gerado aqui no service worker (padrão do Chrome para gravar num documento offscreen).
  // Abrir o popup no Meet já dá à extensão a permissão de capturar aquela aba (activeTab).
  let streamId
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId })
  } catch (err) {
    throw new Error(/invoked|activeTab/i.test(err?.message) ? "Clique no ícone da CORE Meet com a aba do Meet aberta e tente de novo." : `Não foi possível capturar a aba: ${err?.message}`)
  }
  const config = await getConfig()

  const { meeting } = await api("/api/meet/ext/meetings", {
    method: "POST",
    body: { type, client_id: clientId || null, lead_id: leadId || null, title, meet_url: meetUrl },
  })

  await ensureOffscreen()
  const result = await toOffscreen({ type: "start-recording", streamId, meetingId: meeting.id, baseUrl: config.baseUrl, token: config.token, video: Boolean(video) })
  if (!result?.ok) {
    // A captura não começou: cancela a reunião criada para ela não ficar na lista com erro.
    await api(`/api/meet/ext/meetings/${meeting.id}/cancel`, { method: "POST" }).catch(() => {})
    await closeOffscreen()
    throw new Error(result?.error || "Não foi possível capturar o áudio da reunião.")
  }

  await setState({
    recording: { meetingId: meeting.id, title: meeting.title, tabId, type, linkedName: linkedName || null, startedAt: Date.now(), pausedMs: 0, pausedAt: null, uploaded: 0, failed: 0, micOk: result.micOk, videoOk: Boolean(result.videoOk) },
    finished: null,
  })
  chrome.tabs.sendMessage(tabId, { type: "recording-started" }).catch(() => {})
  chrome.action.setBadgeText({ text: "REC" })
  chrome.action.setBadgeBackgroundColor({ color: "#EF4444" })
  return { ok: true, micOk: result.micOk }
}

async function pause(paused) {
  const { recording } = await getState()
  if (!recording) return
  await toOffscreen({ type: paused ? "pause-recording" : "resume-recording" })
  const next = paused
    ? { ...recording, pausedAt: recording.pausedAt || Date.now() }
    : { ...recording, pausedMs: recording.pausedMs + (recording.pausedAt ? Date.now() - recording.pausedAt : 0), pausedAt: null }
  await setState({ recording: next })
  chrome.action.setBadgeText({ text: paused ? "II" : "REC" })
  chrome.tabs.sendMessage(recording.tabId, { type: paused ? "recording-paused" : "recording-started" }).catch(() => {})
}

async function stop() {
  const { recording } = await getState()
  if (!recording) return { ok: true }
  const config = await getConfig()
  await setState({ recording: { ...recording, stopping: true } })

  // O offscreen fecha a última parte e espera todas as partes subirem ao armazenamento da CORE.
  const upload = await toOffscreen({ type: "stop-recording" }).catch((e) => ({ error: e.message }))

  let finishError = null
  try {
    // Ao finalizar, a CORE transcreve o áudio (Whisper, gratuito) e só depois passa para a IA.
    await api(`/api/meet/ext/meetings/${recording.meetingId}/finish`, {
      method: "POST",
      body: { audio_bytes: upload?.bytes || null, video_bytes: upload?.videoBytes || null, duration_seconds: elapsedSeconds(recording) },
    })
  } catch (err) {
    finishError = err.message
  }

  await closeOffscreen()
  chrome.tabs.sendMessage(recording.tabId, { type: "recording-stopped" }).catch(() => {})
  chrome.action.setBadgeText({ text: "" })
  const finished = {
    meetingId: recording.meetingId,
    title: recording.title,
    url: `${config.baseUrl}/reunioes/${recording.meetingId}`,
    audioError: upload?.error || (upload?.failed ? `${upload.failed} arquivo(s) da gravação não foram enviados.` : null),
    error: finishError,
  }
  await setState({ recording: null, finished })
  return { ok: !finishError, ...finished }
}

// ---------- mensagens ----------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target === "offscreen") return false
  const handle = async () => {
    switch (message?.type) {
      case "get-state": {
        const [config, state] = await Promise.all([getConfig(), getState()])
        return {
          config: config ? { baseUrl: config.baseUrl, userName: config.userName, tokenName: config.tokenName } : null,
          recording: state.recording ? { ...state.recording, elapsed: elapsedSeconds(state.recording) } : null,
          finished: state.finished,
        }
      }
      case "connect": {
        const config = { baseUrl: message.baseUrl, token: message.token }
        const me = await api("/api/meet/ext/me", { config })
        await chrome.storage.local.set({ config: { ...config, userName: me.user_name || null, tokenName: me.token_name } })
        return { ok: true, userName: me.user_name, transcription: me.transcription_enabled }
      }
      case "disconnect":
        await chrome.storage.local.remove("config")
        return { ok: true }
      case "options":
        return api(`/api/meet/ext/options?type=${encodeURIComponent(message.kind)}`)
      case "start":
        return start(message)
      case "pause":
        await pause(true)
        return { ok: true }
      case "resume":
        await pause(false)
        return { ok: true }
      case "stop":
        return stop()
      case "clear-finished":
        await setState({ finished: null })
        return { ok: true }
      case "part-uploaded": {
        const { recording } = await getState()
        if (recording) await setState({ recording: { ...recording, uploaded: message.uploaded, failed: message.failed } })
        return { ok: true }
      }
      case "keepalive":
        return { ok: true }
      case "is-recording": {
        const { recording } = await getState()
        return { recording: Boolean(recording && sender.tab?.id === recording.tabId), paused: Boolean(recording?.pausedAt) }
      }
      default:
        return { ok: false, error: "Mensagem desconhecida" }
    }
  }
  handle().then(sendResponse, (err) => sendResponse({ ok: false, error: err?.message || String(err) }))
  return true // resposta assíncrona
})

// Fechou a aba do Meet durante a gravação: encerra e envia o que já foi gravado.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { recording } = await getState()
  if (recording && recording.tabId === tabId && !recording.stopping) stop().catch(() => {})
})
