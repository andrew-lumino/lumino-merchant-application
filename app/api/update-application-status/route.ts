import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAuth, validateUUID } from "@/lib/auth"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const ALLOWED_STATUSES = ["draft", "drafted", "invited", "in_progress", "submitted", "approved", "rejected", "on_hold"]

export async function POST(request: Request) {
  const auth = await requireAuth(false)
  if (!auth.authorized) {
    return auth.response
  }

  try {
    const { applicationId, status } = await request.json()

    if (!applicationId || !status) {
      return NextResponse.json({ success: false, error: "Application ID and status are required" }, { status: 400 })
    }

    if (!validateUUID(applicationId)) {
      return NextResponse.json({ success: false, error: "Invalid application ID format" }, { status: 400 })
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      console.error("[v0] Invalid status value:", status, "Allowed:", ALLOWED_STATUSES)
      return NextResponse.json({ success: false, error: `Invalid status value: ${status}` }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("merchant_applications")
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq("id", applicationId)
      .select("status")
      .single()

    if (error) {
      console.error("[v0] Supabase error updating status:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[v0] Error updating application status:", error)
    return NextResponse.json({ success: false, error: "Failed to update status" }, { status: 500 })
  }
}
