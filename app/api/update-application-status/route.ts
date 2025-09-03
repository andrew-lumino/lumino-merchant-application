import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  try {
    const { applicationId, status } = await request.json()

    if (!applicationId || !status) {
      return NextResponse.json({ success: false, error: "Application ID and status are required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("merchant_applications")
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq("id", applicationId)
      .select("status")
      .single()

    if (error) {
      console.error("Supabase error updating status:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error updating application status:", error)
    return NextResponse.json({ success: false, error: "Failed to update status" }, { status: 500 })
  }
}
