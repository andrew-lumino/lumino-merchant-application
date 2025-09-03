// STEP 1: Enhanced API with better debugging
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { currentUser } from "@clerk/nextjs/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  try {
    console.log("🔍 API called - starting debug")
    
    const user = await currentUser()
    if (!user) {
      console.log("❌ No user found")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    console.log("✅ User authenticated:", user.id)

    // Parse request body with better error handling
    let requestBody
    try {
      requestBody = await request.json()
      console.log("📝 Request body received:", JSON.stringify(requestBody, null, 2))
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError)
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { applicationId, notes } = requestBody

    // Enhanced validation with detailed logging
    console.log("🔍 Validating request data:")
    console.log("  - applicationId:", applicationId, typeof applicationId)
    console.log("  - notes:", Array.isArray(notes) ? `Array with ${notes.length} items` : typeof notes)
    console.log("  - notes content:", JSON.stringify(notes, null, 2))

    if (!applicationId) {
      console.log("❌ Missing applicationId")
      return NextResponse.json({ success: false, error: "Application ID is required" }, { status: 400 })
    }

    if (!notes || !Array.isArray(notes)) {
      console.log("❌ Invalid notes format - expected array, got:", typeof notes)
      return NextResponse.json({ success: false, error: "Notes must be an array" }, { status: 400 })
    }

    // Check if application exists first
    console.log("🔍 Checking if application exists...")
    const { data: existingApp, error: fetchError } = await supabase
      .from("merchant_applications")
      .select("id, notes")
      .eq("id", applicationId)
      .single()

    if (fetchError) {
      console.error("❌ Error fetching application:", fetchError)
      return NextResponse.json({ success: false, error: `Application not found: ${fetchError.message}` }, { status: 404 })
    }
    console.log("✅ Application found:", existingApp.id)
    console.log("📝 Current notes:", existingApp.notes)

    // Update with detailed logging
    console.log("🔄 Updating notes...")
    const { data, error } = await supabase
      .from("merchant_applications")
      .update({ 
        notes: notes, 
        updated_at: new Date().toISOString() 
      })
      .eq("id", applicationId)
      .select("notes")
      .single()

    if (error) {
      console.error("❌ Supabase update error:", error)
      console.error("  - Error code:", error.code)
      console.error("  - Error message:", error.message)
      console.error("  - Error details:", error.details)
      console.error("  - Error hint:", error.hint)
      return NextResponse.json({ success: false, error: `Database error: ${error.message}` }, { status: 500 })
    }

    console.log("✅ Update successful!")
    console.log("📝 Updated notes:", data.notes)
    return NextResponse.json({ success: true, notes: data.notes })

  } catch (error) {
    console.error("❌ Unexpected error:", error)
    console.error("  - Error stack:", error instanceof Error ? error.stack : "No stack trace")
    const errorMessage = error instanceof Error ? error.message : "An internal error occurred"
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

// STEP 2: Add a test endpoint to check your column type
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const applicationId = searchParams.get('applicationId')
    
    if (!applicationId) {
      return NextResponse.json({ success: false, error: "Application ID required" }, { status: 400 })
    }

    // Get application with notes to see current structure
    const { data, error } = await supabase
      .from("merchant_applications")
      .select("id, notes")
      .eq("id", applicationId)
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      applicationId: data.id,
      notes: data.notes,
      notesType: typeof data.notes,
      isArray: Array.isArray(data.notes),
      notesLength: Array.isArray(data.notes) ? data.notes.length : "N/A"
    })
  } catch (error) {
    console.error("Error in GET:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
