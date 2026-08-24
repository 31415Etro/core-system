import { NextResponse } from "next/server"
import { asaasConfigured, asaasEnvironment, getAsaasBalance } from "@/lib/asaas"

export async function GET() {
  if (!asaasConfigured()) {
    return NextResponse.json({ error: "ASAAS_API_KEY não configurada" }, { status: 503 })
  }
  try {
    const data = await getAsaasBalance()
    return NextResponse.json({ balance: data.balance, environment: asaasEnvironment() })
  } catch (error) {
    console.error("[v0] Error fetching ASAAS balance:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao consultar saldo" }, { status: 500 })
  }
}
