// CORE Meet — popup
import { DEFAULT_BASE_URL, normalizeBaseUrl } from "./api.js"

const app = document.getElementById("app")
const send = (message) => chrome.runtime.sendMessage(message)
const MEET_ROOM = /^https:\/\/meet\.google\.com\/[a-z]{3,4}-[a-z]{3,4}-[a-z]{3,4}/i

let timerHandle = null

function mount(id) {
  clearInterval(timerHandle)
  app.replaceChildren(document.getElementById(id).content.cloneNode(true))
}
const $ = (id) => document.getElementById(id)
function showError(id, message) { const el = $(id); el.textContent = message; el.hidden = !message }
const fmt = (s) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":")

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

// ---------- telas ----------
async function render() {
  const state = await send({ type: "get-state" })
  const conn = $("conn"), footer = $("footer")
  if (state?.config) {
    conn.hidden = false
    conn.textContent = new URL(state.config.baseUrl).host
    footer.hidden = false
    $("who").textContent = state.config.userName ? `Conectado como ${state.config.userName}` : `Token: ${state.config.tokenName || "ativo"}`
  } else { conn.hidden = true; footer.hidden = true }

  if (!state?.config) return renderSetup()
  if (state.recording) return renderRecording(state.recording)
  if (state.finished) return renderDone(state.finished)
  const tab = await activeTab()
  if (!tab?.url || !MEET_ROOM.test(tab.url)) return mount("tpl-not-meet")
  return renderReady(tab)
}

function renderSetup() {
  mount("tpl-setup")
  chrome.storage.local.get("lastBaseUrl").then(({ lastBaseUrl }) => {
    let value = DEFAULT_BASE_URL
    try { if (lastBaseUrl) value = normalizeBaseUrl(lastBaseUrl) } catch {}
    $("baseUrl").value = value
  })
  $("connectBtn").addEventListener("click", async () => {
    let baseUrl
    try { baseUrl = normalizeBaseUrl($("baseUrl").value) } catch (e) { return showError("setupError", e.message) }
    const token = $("token").value.trim()
    if (!token.startsWith("cmeet_")) return showError("setupError", "Token inválido. Ele começa com cmeet_.")
    // Permissão para falar com o servidor da CORE (pedida no clique, como o Chrome exige).
    const granted = await chrome.permissions.request({ origins: [`${baseUrl}/*`] }).catch(() => false)
    if (!granted) return showError("setupError", "Permita o acesso ao endereço da CORE para continuar.")
    $("connectBtn").disabled = true
    $("connectBtn").textContent = "Conectando…"
    $("baseUrl").value = baseUrl
    const result = await send({ type: "connect", baseUrl, token })
    chrome.storage.local.set({ lastBaseUrl: baseUrl })
    if (result?.ok && result.transcription === false) alert("Conectado! Atenção: a transcrição de áudio (Whisper) ainda não está configurada no servidor da CORE (TRANSCRIPTION_BASE_URL). As gravações ficarão salvas, mas a ata só sai depois de configurar.")
    if (!result?.ok) {
      $("connectBtn").disabled = false
      $("connectBtn").textContent = "Conectar"
      return showError("setupError", result?.error || "Não foi possível conectar.")
    }
    render()
  })
}

async function micStatus() {
  try { return (await navigator.permissions.query({ name: "microphone" })).state } catch { return "prompt" }
}

async function renderReady(tab) {
  mount("tpl-ready")
  let type = "interna"
  let selected = null
  let items = []

  const mic = await micStatus()
  const videoToggle = $("videoToggle")
  chrome.storage.local.get("recordVideo").then(({ recordVideo }) => { videoToggle.checked = Boolean(recordVideo) })
  videoToggle.addEventListener("change", () => chrome.storage.local.set({ recordVideo: videoToggle.checked }))
  const micRow = $("micRow")
  if (mic === "granted") micRow.innerHTML = `<span>Microfone</span><span class="ok">● Liberado</span>`
  else if (mic === "denied") {
    micRow.innerHTML = `<span>Microfone <span class="bad">bloqueado</span> — sua voz não será gravada</span><button class="btn" id="micBtn">Liberar</button>`
    $("micBtn").addEventListener("click", () => chrome.tabs.create({ url: "chrome://settings/content/microphone" }))
  }
  else {
    micRow.innerHTML = `<span>Microfone <span class="bad">não liberado</span></span><button class="btn" id="micBtn">Permitir</button>`
    $("micBtn").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("permission.html") }))
  }

  const renderList = () => {
    const q = $("pickerSearch").value.trim().toLowerCase()
    const list = $("pickerList")
    const filtered = items.filter((i) => `${i.name} ${i.detail || ""}`.toLowerCase().includes(q)).slice(0, 80)
    list.replaceChildren(...(filtered.length ? filtered.map((i) => {
      const li = document.createElement("li")
      li.setAttribute("role", "option")
      li.setAttribute("aria-selected", String(selected?.id === i.id))
      li.tabIndex = 0
      li.innerHTML = `<span></span><small></small>`
      li.firstChild.textContent = i.name
      li.lastChild.textContent = i.detail || ""
      const pick = () => { selected = i; renderList() }
      li.addEventListener("click", pick)
      li.addEventListener("keydown", (e) => { if (e.key === "Enter") pick() })
      return li
    }) : [Object.assign(document.createElement("li"), { className: "empty", textContent: items.length ? "Nada encontrado" : "Carregando…" })]))
  }

  async function setType(next) {
    type = next
    selected = null
    showError("readyError", "")
    document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.type === next)))
    const wrap = $("pickerWrap")
    wrap.hidden = next === "interna"
    if (next === "interna") return
    $("pickerLabel").textContent = next === "cliente" ? "Cliente" : "Lead"
    $("pickerSearch").value = ""
    items = []
    renderList()
    const result = await send({ type: "options", kind: next })
    if (type !== next) return
    if (result?.error) return showError("readyError", result.error)
    items = result.items || []
    if (!items.length) $("pickerList").replaceChildren(Object.assign(document.createElement("li"), { className: "empty", textContent: next === "cliente" ? "Nenhum cliente cadastrado na CORE" : "Nenhum lead em aberto na CORE" }))
    else renderList()
  }

  document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => setType(b.dataset.type)))
  $("pickerSearch").addEventListener("input", renderList)

  $("startBtn").addEventListener("click", async () => {
    if (type !== "interna" && !selected) return showError("readyError", `Selecione o ${type === "cliente" ? "cliente" : "lead"} da reunião.`)
    const btn = $("startBtn")
    btn.disabled = true
    btn.textContent = "Iniciando…"
    try {
      const result = await send({
        type: "start", tabId: tab.id, meetingType: type,
        clientId: type === "cliente" ? selected.id : null,
        leadId: type === "lead" ? selected.id : null,
        linkedName: selected?.name || null,
        title: $("title").value.trim(),
        meetUrl: tab.url,
        video: videoToggle.checked,
      })
      if (!result?.ok) throw new Error(result?.error || "Não foi possível iniciar.")
      render()
    } catch (err) {
      btn.disabled = false
      btn.innerHTML = `<span class="dot"></span>Iniciar gravação`
      showError("readyError", err.message)
    }
  })
}

function renderRecording(rec) {
  mount("tpl-recording")
  const paused = Boolean(rec.pausedAt)
  const base = rec.elapsed
  const shownAt = Date.now()
  $("recDot").classList.toggle("paused", paused)
  $("recLabel").textContent = paused ? "Pausado" : "Gravando"
  $("recTitle").textContent = rec.title
  $("recLinked").textContent = `${rec.type === "interna" ? "Reunião interna da equipe" : `${rec.type === "cliente" ? "Cliente" : "Lead"}: ${rec.linkedName || ""}`} · ${rec.videoOk ? "áudio + vídeo" : "só áudio"}`
  const partsInfo = (r) => `${r.uploaded || 0} arquivo(s) já enviados à CORE${r.failed ? ` · ${r.failed} com falha` : ""}`
  $("recInfo").textContent = partsInfo(rec)
  if (!rec.micOk) { $("recWarn").hidden = false; $("recWarn").textContent = "Seu microfone não está sendo gravado (permissão negada): só a voz dos outros participantes vai para a ata." }
  const tick = () => { $("timer").textContent = fmt(paused ? base : base + Math.floor((Date.now() - shownAt) / 1000)) }
  tick()
  timerHandle = setInterval(tick, 1000)
  // Atualiza o contador de partes enviadas.
  const refresh = setInterval(async () => {
    const s = await send({ type: "get-state" })
    if (!s?.recording) { clearInterval(refresh); return }
    if ($("recInfo")) $("recInfo").textContent = partsInfo(s.recording)
  }, 5000)

  $("pauseBtn").textContent = paused ? "Retomar" : "Pausar"
  $("pauseBtn").addEventListener("click", async () => { await send({ type: paused ? "resume" : "pause" }); clearInterval(refresh); render() })
  $("stopBtn").addEventListener("click", async () => {
    clearInterval(refresh)
    mount("tpl-sending")
    const result = await send({ type: "stop" })
    if (result?.error && !result?.meetingId) { mount("tpl-not-meet"); return }
    render()
  })
}

function renderDone(done) {
  mount("tpl-done")
  const warns = [done.error && `Erro ao finalizar: ${done.error}`, done.audioError && `Áudio: ${done.audioError}`].filter(Boolean)
  if (warns.length) { $("doneWarn").hidden = false; $("doneWarn").textContent = warns.join(" ") }
  $("openBtn").addEventListener("click", () => chrome.tabs.create({ url: done.url }))
  $("newBtn").addEventListener("click", async () => { await send({ type: "clear-finished" }); render() })
}

$("disconnectBtn").addEventListener("click", async () => { await send({ type: "disconnect" }); render() })
render()
