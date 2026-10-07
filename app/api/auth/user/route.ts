import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    console.log("[v0] GET /api/auth/user called")
    const supabase = await createClient()

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    console.log("[v0] Auth user check:", {
      hasUser: !!authUser,
      userId: authUser?.id,
      error: authError?.message,
    })

    if (authError || !authUser) {
      console.log("[v0] No authenticated user found")
      return NextResponse.json({ user: null })
    }

    console.log("[v0] Fetching profile for user:", authUser.id)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single()

    console.log("[v0] Profile fetch result:", {
      hasProfile: !!profile,
      profileEmail: profile?.email,
      error: profileError?.message,
    })

    if (profileError) {
      console.error("[v0] Profile fetch error:", profileError)
      return NextResponse.json({ user: null })
    }

    if (!profile || profile.active === false) {
      console.error("[v0] No profile found for user:", authUser.id)
      return NextResponse.json({ user: null })
    }

    const storedPermissions = Array.isArray(profile.page_permissions) ? profile.page_permissions : []
    const user = {
      id: authUser.id,
      name: profile.full_name || authUser.email?.split("@")[0] || "User",
      email: profile.email || authUser.email || "",
      role: profile.role || "user",
      permissions: storedPermissions,
      clientId: profile.client_id || null,
      // Lido direto do Auth (o token da sessão guarda os dados de quando a pessoa entrou).
      mustChangePassword: (await createAdminClient().auth.admin.getUserById(authUser.id)).data.user?.user_metadata?.must_change_password === true,
    }

    console.log("[v0] Returning user data:", { id: user.id, email: user.email, role: user.role })
    return NextResponse.json({ user })
  } catch (error) {
    console.error("[v0] Get user exception:", error)
    return NextResponse.json({ user: null })
  }
}
