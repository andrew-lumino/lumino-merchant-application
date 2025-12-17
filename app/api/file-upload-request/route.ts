import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { applicationId, requestedFiles } = await request.json()

    if (!applicationId || !requestedFiles || requestedFiles.length === 0) {
      return NextResponse.json({ error: "Application ID and requested files are required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("file_upload_requests")
      .insert({
        application_id: applicationId,
        requested_files: requestedFiles,
        is_active: true,
      })
      .select("id")
      .single()

    if (error) {
      console.error("Error creating file upload request:", error)
      return NextResponse.json({ error: "Failed to create upload request" }, { status: 500 })
    }

    return NextResponse.json({ id: data.id })
  } catch (error) {
    console.error("Error in file upload request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get("id")

    if (!requestId) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("file_upload_requests")
      .select(`
        id,
        application_id,
        is_active,
        requested_files,
        created_at,
        completed_at,
        merchant_applications (
          business_name
        )
      `)
      .eq("id", requestId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Upload request not found" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching file upload request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
