import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { currentUser } from "@clerk/nextjs/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: No user found." }, 
        { status: 401 }
      )
    }

    const userEmail = user.primaryEmailAddress?.emailAddress

    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: "User email not found." }, 
        { status: 404 }
      )
    }

    console.log(`Fetching invites for agent: ${userEmail}`)

    // ✅ Add more fields and ensure we get the latest data
    const { data, error: supabaseError } = await supabase
      .from("merchant_applications")
      .select("id, dba_name, dba_email, status, created_at, updated_at, agent_email")
      .eq("agent_email", userEmail)
      .order("created_at", { ascending: false })
      .limit(50) // Limit to last 50 for performance

    if (supabaseError) {
      console.error("Supabase error fetching invites:", supabaseError)
      return NextResponse.json(
        { success: false, error: `Database error: ${supabaseError.message}` }, 
        { status: 500 }
      )
    }

    console.log(`Found ${data?.length || 0} invites for ${userEmail}`)

    return NextResponse.json({ 
      success: true, 
      invites: data || [],
      agent_email: userEmail,
      timestamp: new Date().toISOString() // ✅ Add timestamp for debugging
    })

  } catch (error) {
    console.error("Error in get-agent-invites:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "An unexpected error occurred while fetching invites.",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}
