import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { cancelAsaasSubscription } from "@/lib/asaas"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { data: subscription, error: fetchError } = await supabase
      .from("asaas_subscriptions")
      .select("asaas_subscription_id")
      .eq("id", id)
      .single()
    if (fetchError || !subscription) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 })

    await cancelAsaasSubscription(subscription.asaas_subscription_id)

    const { error: updateError } = await supabase.from("asaas_subscriptions").update({ status: "CANCELLED" }).eq("id", id)
    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error cancelling ASAAS subscription:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao cancelar assinatura" }, { status: 500 })
  }
}
