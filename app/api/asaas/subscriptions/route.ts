import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { asaasConfigured, createAsaasSubscription, createOrGetAsaasCustomer } from "@/lib/asaas"

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("asaas_subscriptions")
      .select("*, clients(name)")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching asaas_subscriptions:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ subscriptions: data ?? [] })
  } catch (error) {
    console.error("[v0] Error fetching asaas_subscriptions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!asaasConfigured()) {
    return NextResponse.json({ error: "ASAAS_API_KEY não configurada" }, { status: 503 })
  }
  try {
    const body = await request.json()
    const { clientId, name, document, email, phone, billingType, value, cycle, nextDueDate, description, endDate } = body

    if (!name || !document) return NextResponse.json({ error: "Nome e CPF/CNPJ são obrigatórios" }, { status: 400 })
    if (!billingType || !value || !cycle || !nextDueDate) return NextResponse.json({ error: "Forma de cobrança, valor, periodicidade e próximo vencimento são obrigatórios" }, { status: 400 })

    const supabase = createAdminClient()

    let resolvedClientId = clientId || null
    let asaasCustomerId: string | null = null

    if (resolvedClientId) {
      const { data: client } = await supabase.from("clients").select("*").eq("id", resolvedClientId).single()
      asaasCustomerId = client?.asaas_customer_id || null
    }

    if (!asaasCustomerId) {
      const customer = await createOrGetAsaasCustomer({ name, cpfCnpj: document, email, phone, externalReference: resolvedClientId || undefined })
      asaasCustomerId = customer.id

      if (resolvedClientId) {
        await supabase.from("clients").update({ asaas_customer_id: asaasCustomerId }).eq("id", resolvedClientId)
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({ name, document, email, phone, status: "active", asaas_customer_id: asaasCustomerId })
          .select("id")
          .single()
        if (clientError) throw clientError
        resolvedClientId = newClient.id
      }
    }

    const subscription = await createAsaasSubscription({
      customerId: asaasCustomerId, billingType, value: Number(value), cycle, nextDueDate,
      description, endDate: endDate || undefined, externalReference: resolvedClientId || undefined,
    })

    const { data: saved, error: saveError } = await supabase
      .from("asaas_subscriptions")
      .insert({
        client_id: resolvedClientId, asaas_customer_id: asaasCustomerId, asaas_subscription_id: subscription.id,
        billing_type: subscription.billingType, value: subscription.value, cycle: subscription.cycle,
        next_due_date: subscription.nextDueDate, end_date: subscription.endDate || null,
        description: description || null, status: subscription.status,
      })
      .select("*")
      .single()

    if (saveError) throw saveError

    return NextResponse.json({ subscription: saved }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating ASAAS subscription:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao criar assinatura" }, { status: 500 })
  }
}
