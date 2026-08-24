import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const PAID_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"])

export async function POST(request: Request) {
  try {
    // Token de acesso configurado no painel ASAAS (Integrações > Webhooks), enviado no header asaas-access-token.
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN
    if (expectedToken && request.headers.get("asaas-access-token") !== expectedToken) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 })
    }

    const body = await request.json()
    const event = body.event
    const payment = body.payment
    if (!payment?.id) return NextResponse.json({ received: true })

    const supabase = createAdminClient()
    const updateData: Record<string, unknown> = { status: payment.status }
    if (PAID_EVENTS.has(event)) updateData.paid_at = payment.paymentDate ? `${payment.paymentDate}T12:00:00+00` : new Date().toISOString()

    const { error } = await supabase.from("asaas_charges").update(updateData).eq("asaas_payment_id", payment.id)
    if (error) console.error("[v0] Error updating asaas_charges from webhook:", error)

    console.log(`[v0] ASAAS webhook: ${event} for payment ${payment.id}`)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[v0] Error processing ASAAS webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
