import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const formData = await request.formData()

    const requestId = formData.get("requestId") as string
    const applicationId = formData.get("applicationId") as string
    const filesJson = formData.get("files") as string

    if (!requestId || !applicationId) {
      return NextResponse.json({ error: "Request ID and Application ID are required" }, { status: 400 })
    }

    // Verify the request is still active
    const { data: uploadRequest, error: requestError } = await supabase
      .from("file_upload_requests")
      .select("is_active")
      .eq("id", requestId)
      .single()

    if (requestError || !uploadRequest) {
      return NextResponse.json({ error: "Upload request not found" }, { status: 404 })
    }

    if (!uploadRequest.is_active) {
      return NextResponse.json({ error: "This upload link has already been used" }, { status: 400 })
    }

    // Parse the files data
    const files = JSON.parse(filesJson) as Array<{
      documentType: string
      fileUrl: string
      fileName: string
    }>

    // Insert files into merchant_uploads
    const uploadsToInsert = files.map((file) => ({
      application_id: applicationId,
      document_type: file.documentType,
      file_url: file.fileUrl,
      upload_type: "file",
    }))

    const { error: uploadError } = await supabase.from("merchant_uploads").insert(uploadsToInsert)

    if (uploadError) {
      console.error("Error inserting uploads:", uploadError)
      return NextResponse.json({ error: "Failed to save uploaded files" }, { status: 500 })
    }

    // Mark the request as completed
    const { error: updateError } = await supabase
      .from("file_upload_requests")
      .update({
        is_active: false,
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestId)

    if (updateError) {
      console.error("Error updating request status:", updateError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error submitting files:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
