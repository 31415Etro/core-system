// CORE Meet — roda dentro do Google Meet só para mostrar o selo "gravando" na chamada.
// A gravação em si (microfone + som da reunião) acontece no documento offscreen da extensão;
// não depende de legendas nem de recursos pagos do Meet.
(() => {
  let pill = null

  function showPill(state) {
    if (!state) { pill?.remove(); pill = null; return }
    if (!pill) {
      pill = document.createElement("div")
      pill.setAttribute("role", "status")
      pill.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(10,10,11,.85);border:1px solid rgba(255,196,0,.35);color:#f7f7f7;font:600 12px/1.2 system-ui,sans-serif;backdrop-filter:blur(12px);pointer-events:none"
      document.body.appendChild(pill)
    }
    const dot = state === "paused" ? "#a1a1aa" : "#ef4444"
    pill.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${dot}"></span>CORE Meet ${state === "paused" ? "pausado" : "gravando"}`
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "recording-started") showPill("recording")
    if (message?.type === "recording-paused") showPill("paused")
    if (message?.type === "recording-stopped") showPill(null)
  })

  // Se a página do Meet recarregar durante a gravação, o selo volta.
  chrome.runtime.sendMessage({ type: "is-recording" }).then((s) => { if (s?.recording) showPill(s.paused ? "paused" : "recording") }).catch(() => {})
})()
