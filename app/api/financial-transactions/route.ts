import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const supabase = createAdminClient()
    let query = supabase.from("financial_transactions").select("*").order("transaction_date", { ascending: false })
    if (from) query = query.gte("transaction_date", from)
    if (to) query = query.lte("transaction_date", to)
    const { data, error } = await query

    if (error) {
      console.error("[v0] Error fetching financial transactions:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ transactions: data ?? [] })
  } catch (error) {
    console.error("[v0] Error fetching financial transactions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const description = typeof body.description === "string" ? body.description.trim() : ""
    const type = body.type === "expense" ? "expense" : body.type === "income" ? "income" : null
    const amount = Number(body.amount)

    if (!description) return NextResponse.json({ error: "Descrição é obrigatória" }, { status: 400 })
    if (!type) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
    if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
    if (!body.transaction_date) return NextResponse.json({ error: "Data é obrigatória" }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("financial_transactions")
      .insert({
        type,
        description,
        amount,
        transaction_date: body.transaction_date,
        status: body.status === "pending" ? "pending" : "paid",
        account_name: body.account_name || null,
        category: body.category || null,
        paid_at: body.status === "pending" ? null : new Date().toISOString(),
      })
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error creating financial transaction:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ transaction: data }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating financial transaction:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
