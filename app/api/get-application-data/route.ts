import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ success: false, error: "Application ID is required" }, { status: 400 })
    }

    const { data, error } = await supabase.from("merchant_applications").select("*").eq("id", id).single()

    if (error) {
      if (error.code === "PGRST116") {
        // This code means no rows were found
        return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 })
      }
      console.error("Supabase error:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error fetching application data:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch application data" }, { status: 500 })
  }
}
