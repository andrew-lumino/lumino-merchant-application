import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAuth, validateUUID } from "@/lib/auth"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.authorized) {
    return auth.response
  }

  try {
    console.log("🔍 API called - starting debug")

    let requestBody
    try {
      requestBody = await request.json()
      console.log("📝 Request body received:", JSON.stringify(requestBody, null, 2))
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError)
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { applicationId, notes } = requestBody

    console.log("🔍 Validating request data:")
    console.log("  - applicationId:", applicationId, typeof applicationId)
    console.log("  - notes:", Array.isArray(notes) ? `Array with ${notes.length} items` : typeof notes)

    if (!applicationId) {
      console.log("❌ Missing applicationId")
      return NextResponse.json({ success: false, error: "Application ID is required" }, { status: 400 })
    }

    if (!validateUUID(applicationId)) {
      return NextResponse.json({ success: false, error: "Invalid application ID format" }, { status: 400 })
    }

    if (!notes || !Array.isArray(notes)) {
      console.log("❌ Invalid notes format - expected array, got:", typeof notes)
      return NextResponse.json({ success: false, error: "Notes must be an array" }, { status: 400 })
    }

    const sanitizedNotes = notes.map((note) => {
      if (typeof note === "string") {
        return note.substring(0, 5000) // Limit length
      }
      if (typeof note === "object" && note !== null) {
        return {
          ...note,
          text: typeof note.text === "string" ? note.text.substring(0, 5000) : "",
        }
      }
      return note
    })

    console.log("🔍 Checking if application exists...")
    const { data: existingApp, error: fetchError } = await supabase
      .from("merchant_applications")
      .select("id, notes")
      .eq("id", applicationId)
      .single()

    if (fetchError) {
      console.error("❌ Error fetching application:", fetchError)
      return NextResponse.json(
        { success: false, error: `Application not found: ${fetchError.message}` },
        { status: 404 },
      )
    }
    console.log("✅ Application found:", existingApp.id)

    console.log("🔄 Updating notes...")
    const { data, error } = await supabase
      .from("merchant_applications")
      .update({
        notes: sanitizedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .select("notes")
      .single()

    if (error) {
      console.error("❌ Supabase update error:", error)
      return NextResponse.json({ success: false, error: `Database error: ${error.message}` }, { status: 500 })
    }

    console.log("✅ Update successful!")
    return NextResponse.json({ success: true, notes: data.notes })
  } catch (error) {
    console.error("❌ Unexpected error:", error)
    const errorMessage = error instanceof Error ? error.message : "An internal error occurred"
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.authorized) {
    return auth.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const applicationId = searchParams.get("applicationId")

    if (!applicationId) {
      return NextResponse.json({ success: false, error: "Application ID required" }, { status: 400 })
    }

    if (!validateUUID(applicationId)) {
      return NextResponse.json({ success: false, error: "Invalid application ID format" }, { status: 400 })
    }

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
      notesLength: Array.isArray(data.notes) ? data.notes.length : "N/A",
    })
  } catch (error) {
    console.error("Error in GET:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
