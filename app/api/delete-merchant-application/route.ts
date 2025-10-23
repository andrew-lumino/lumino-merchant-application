import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateUUID } from "@/lib/auth"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    if (!validateUUID(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 })
    }

    const { error } = await supabase.from("merchant_applications").delete().eq("id", id)

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting application:", error)
    return NextResponse.json({ error: "Failed to delete application" }, { status: 500 })
  }
}
