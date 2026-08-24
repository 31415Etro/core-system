import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { asaasConfigured, createAsaasCharge, createOrGetAsaasCustomer } from "@/lib/asaas"

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("asaas_charges")
      .select("*, clients(name)")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching asaas_charges:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ charges: data ?? [] })
  } catch (error) {
    console.error("[v0] Error fetching asaas_charges:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!asaasConfigured()) {
    return NextResponse.json({ error: "ASAAS_API_KEY não configurada" }, { status: 503 })
  }
  try {
    const body = await request.json()
    const { clientId, name, document, email, phone, billingType, value, dueDate, description } = body

    if (!name || !document) return NextResponse.json({ error: "Nome e CPF/CNPJ são obrigatórios" }, { status: 400 })
    if (!billingType || !value || !dueDate) return NextResponse.json({ error: "Forma de cobrança, valor e vencimento são obrigatórios" }, { status: 400 })

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

    const charge = await createAsaasCharge({
      customerId: asaasCustomerId, billingType, value: Number(value), dueDate, description,
      externalReference: resolvedClientId || undefined,
    })

    const { data: savedCharge, error: saveError } = await supabase
      .from("asaas_charges")
      .insert({
        client_id: resolvedClientId, asaas_customer_id: asaasCustomerId, asaas_payment_id: charge.id,
        billing_type: charge.billingType, value: charge.value, net_value: charge.netValue, due_date: charge.dueDate,
        description: description || null, status: charge.status, invoice_url: charge.invoiceUrl,
        bank_slip_url: charge.bankSlipUrl || null, pix_qr_code_id: charge.pixQrCodeId || null,
        external_reference: resolvedClientId,
      })
      .select("*")
      .single()

    if (saveError) throw saveError

    return NextResponse.json({ charge: savedCharge }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating ASAAS charge:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao criar cobrança" }, { status: 500 })
  }
}
