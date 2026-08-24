import { NextResponse } from "next/server"
import { asaasConfigured, asaasEnvironment, getAsaasStatement } from "@/lib/asaas"

export async function GET(request: Request) {
  if (!asaasConfigured()) {
    return NextResponse.json({ error: "ASAAS_API_KEY não configurada" }, { status: 503 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const today = new Date()
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
    const defaultFinish = today.toISOString().slice(0, 10)
    const startDate = searchParams.get("startDate") || defaultStart
    const finishDate = searchParams.get("finishDate") || defaultFinish
    const offset = Number(searchParams.get("offset") || 0)

    const data = await getAsaasStatement({ startDate, finishDate, offset, limit: 100 })
    return NextResponse.json({ ...data, environment: asaasEnvironment() })
  } catch (error) {
    console.error("[v0] Error fetching ASAAS statement:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao consultar extrato" }, { status: 500 })
  }
}
