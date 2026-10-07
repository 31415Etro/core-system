// Cliente da API da CORE usado pela extensão. Autenticação por token (Bearer), nunca por cookie.

export async function getConfig() {
  const { config } = await chrome.storage.local.get("config")
  return config || null
}

export async function api(path, { method = "GET", body, config } = {}) {
  const cfg = config || (await getConfig())
  if (!cfg) throw new Error("Extensão não conectada à CORE.")
  let response
  try {
    response = await fetch(`${cfg.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${cfg.token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error(`Não foi possível acessar ${cfg.baseUrl}. A CORE está no ar?`)
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Erro ${response.status} na CORE.`)
  return payload
}

/** Endereço da CORE publicada (provisório, até o domínio definitivo). */
export const DEFAULT_BASE_URL = "https://core.179-236-244-221.sslip.io"

export function normalizeBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "")
  if (!raw) throw new Error("Informe o endereço da CORE.")
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  // A CORE publicada só atende em HTTPS. Com http://, o servidor redireciona e o navegador
  // descarta o token no redirecionamento ("token ausente"). Só o ambiente local usa http.
  const local = /^(localhost|127\.|\[::1\])/.test(url.hostname)
  if (url.protocol === "http:" && !local) url.protocol = "https:"
  return url.origin
}
