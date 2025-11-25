import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateUUID } from "@/lib/auth"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ success: false, error: "Application ID is required" }, { status: 400 })
    }

    if (!validateUUID(id)) {
      return NextResponse.json({ success: false, error: "Invalid ID format" }, { status: 400 })
    }

    const [applicationResult, uploadsResult] = await Promise.all([
      supabase.from("merchant_applications").select("*").eq("id", id).single(),
      supabase.from("merchant_uploads").select("*").eq("application_id", id),
    ])

    if (applicationResult.error) {
      if (applicationResult.error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 })
      }
      console.error("Supabase error:", applicationResult.error)
      return NextResponse.json({ success: false, error: applicationResult.error.message }, { status: 500 })
    }

    const data = {
      ...applicationResult.data,
      uploads: uploadsResult.data || [],
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error fetching application data:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch application data" }, { status: 500 })
  }
}
