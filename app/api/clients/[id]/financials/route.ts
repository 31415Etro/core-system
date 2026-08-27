import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getSignedClientDocumentUrl } from "@/lib/storage"

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

    async function signedUrlFor(path: string | null | undefined) {
      if (!path) return null
      try {
        return await getSignedClientDocumentUrl(path)
      } catch (err) {
        console.error("[v0] Error signing document url:", err)
        return null
      }
    }

    const financials = data ? {
      ...data,
      contract_signed_url: await signedUrlFor(data.contract_storage_path),
      welcome_presentation_signed_url: await signedUrlFor(data.welcome_presentation_storage_path),
      schedule_presentation_signed_url: await signedUrlFor(data.schedule_presentation_storage_path),
    } : null

    return NextResponse.json({ financials })
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
