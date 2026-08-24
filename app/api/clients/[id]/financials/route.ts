import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getSignedContractUrl } from "@/lib/storage"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("client_financials")
      .select("*")
      .eq("client_id", id)
      .maybeSingle()

    if (error) {
      console.error("[v0] Error fetching client financials:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let contractSignedUrl: string | null = null
    if (data?.contract_storage_path) {
      try {
        contractSignedUrl = await getSignedContractUrl(data.contract_storage_path)
      } catch (err) {
        console.error("[v0] Error signing contract url:", err)
      }
    }

    return NextResponse.json({ financials: data ? { ...data, contract_signed_url: contractSignedUrl } : null })
  } catch (error) {
    console.error("[v0] Error fetching client financials:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = { client_id: id }
    if (body.project_total_value !== undefined) updateData.project_total_value = body.project_total_value
    if (body.installments_total !== undefined) updateData.installments_total = body.installments_total
    if (body.installments_paid !== undefined) updateData.installments_paid = body.installments_paid
    if (body.has_maintenance !== undefined) updateData.has_maintenance = Boolean(body.has_maintenance)
    if (body.maintenance_monthly_value !== undefined) updateData.maintenance_monthly_value = body.maintenance_monthly_value
    if (body.has_change_package !== undefined) updateData.has_change_package = Boolean(body.has_change_package)
    if (body.change_package_scope !== undefined) updateData.change_package_scope = body.change_package_scope
    if (body.notes !== undefined) updateData.notes = body.notes

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("client_financials")
      .upsert(updateData, { onConflict: "client_id" })
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error saving client financials:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ financials: data })
  } catch (error) {
    console.error("[v0] Error saving client financials:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
