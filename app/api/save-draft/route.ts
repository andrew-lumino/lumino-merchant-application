import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAuth } from "@/lib/auth"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.authorized) {
    return auth.response
  }

  try {
    const body = await request.json()
    const { applicationId, formData, principals, uploads, currentStep, timestamp } = body

    if (!applicationId) {
      return NextResponse.json({ success: false, error: "Application ID required" }, { status: 400 })
    }

    // Store draft data in a dedicated column or as metadata
    const draftData = {
      formData,
      principals,
      uploads,
      currentStep,
      timestamp,
    }

    // Update the application with draft data
    const { data, error } = await supabase
      .from("merchant_applications")
      .update({
        // Store as JSON in a draft_data column if available, or merge into main data
        updated_at: new Date().toISOString(),
        status: "drafted", // Ensure status reflects draft state
        // You can add a draft_data jsonb column to store this separately
        // draft_data: draftData,
        // For now, we'll merge the form data if the application exists
        ...formData,
      })
      .eq("id", applicationId)
      .select()

    if (error) {
      console.error("Error saving draft:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error in save-draft:", error)
    return NextResponse.json({ success: false, error: "Failed to save draft" }, { status: 500 })
  }
}
