const BASE_URLS = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
} as const

function getConfig() {
  const apiKey = process.env.ASAAS_API_KEY
  const env = process.env.ASAAS_ENV === "production" ? "production" : "sandbox"
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada")
  return { apiKey, env, baseUrl: BASE_URLS[env] }
}

async function asaasFetch(path: string, init?: RequestInit) {
  const { apiKey, baseUrl } = getConfig()
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "waycore-ti",
      access_token: apiKey,
      ...(init?.headers || {}),
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.errors?.[0]?.description || payload?.message || `Erro ASAAS (HTTP ${response.status})`
    throw new Error(message)
  }
  return payload
}

export function asaasConfigured() {
  return Boolean(process.env.ASAAS_API_KEY)
}

export function asaasEnvironment() {
  return process.env.ASAAS_ENV === "production" ? "production" : "sandbox"
}

export type AsaasCustomer = {
  id: string; name: string; email?: string; cpfCnpj: string; phone?: string
}

export async function createOrGetAsaasCustomer(input: { name: string; cpfCnpj: string; email?: string; phone?: string; externalReference?: string }): Promise<AsaasCustomer> {
  const existing = await asaasFetch(`/customers?cpfCnpj=${encodeURIComponent(input.cpfCnpj)}`)
  if (existing?.data?.length) return existing.data[0]
  return asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name, cpfCnpj: input.cpfCnpj, email: input.email, phone: input.phone,
      externalReference: input.externalReference,
    }),
  })
}

export type AsaasCharge = {
  id: string; status: string; value: number; netValue: number; dueDate: string
  billingType: string; invoiceUrl: string; bankSlipUrl?: string; pixQrCodeId?: string; customer: string
}

export async function createAsaasCharge(input: {
  customerId: string; billingType: "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED"
  value: number; dueDate: string; description?: string; externalReference?: string
}): Promise<AsaasCharge> {
  return asaasFetch("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId, billingType: input.billingType, value: input.value,
      dueDate: input.dueDate, description: input.description, externalReference: input.externalReference,
    }),
  })
}

export async function getAsaasBalance(): Promise<{ balance: number }> {
  return asaasFetch("/finance/balance")
}

export async function getAsaasStatement(params: { startDate: string; finishDate: string; offset?: number; limit?: number }) {
  const query = new URLSearchParams({
    startDate: params.startDate, finishDate: params.finishDate,
    offset: String(params.offset ?? 0), limit: String(params.limit ?? 100),
  })
  return asaasFetch(`/financialTransactions?${query.toString()}`)
}

export async function getAsaasCharge(paymentId: string): Promise<AsaasCharge> {
  return asaasFetch(`/payments/${paymentId}`)
}

export type AsaasSubscription = {
  id: string; customer: string; billingType: string; cycle: string; value: number
  nextDueDate: string; endDate?: string; description?: string; status: string
}

export async function createAsaasSubscription(input: {
  customerId: string; billingType: "BOLETO" | "PIX" | "CREDIT_CARD"
  value: number; cycle: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY"
  nextDueDate: string; description?: string; endDate?: string; externalReference?: string
}): Promise<AsaasSubscription> {
  return asaasFetch("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId, billingType: input.billingType, value: input.value, cycle: input.cycle,
      nextDueDate: input.nextDueDate, description: input.description, endDate: input.endDate,
      externalReference: input.externalReference,
    }),
  })
}

export async function cancelAsaasSubscription(subscriptionId: string) {
  return asaasFetch(`/subscriptions/${subscriptionId}`, { method: "DELETE" })
}
