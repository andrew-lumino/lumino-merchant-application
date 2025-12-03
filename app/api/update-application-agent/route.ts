import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  try {
    const { applicationId, agentName, agentEmail } = await request.json()

    if (!applicationId) {
      return NextResponse.json({ success: false, error: "Application ID is required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("merchant_applications")
      .update({
        agent_name: agentName || null,
        agent_email: agentEmail || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .select()
      .single()

    if (error) {
      console.error("Error updating agent:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, application: data })
  } catch (error) {
    console.error("Error in update-application-agent:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
