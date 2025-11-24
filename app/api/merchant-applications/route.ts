import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAuth } from "@/lib/auth"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: Request) {
  const auth = await requireAuth(false)
  if (!auth.authorized) {
    return auth.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    if (page < 1 || page > 1000) {
      return NextResponse.json({ error: "Invalid page number" }, { status: 400 })
    }
    if (limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid limit (max 100)" }, { status: 400 })
    }

    const offset = (page - 1) * limit

    let query = supabase
      .from("merchant_applications")
      .select(
        `
        *,
        uploads:merchant_uploads(document_type, file_url, upload_type)
      `,
      )
      .order("created_at", { ascending: false })

    if (!auth.isAdmin) {
      query = query.eq("agent_email", auth.email)
    }

    const { data, error } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const appsWithUploads = data.map((app: any) => ({
      ...app,
      uploads: app.uploads.reduce((acc: any, u: any) => {
        acc[u.document_type] = {
          file_url: u.file_url,
          upload_type: u.upload_type,
        }
        return acc
      }, {}),
    }))

    return NextResponse.json(appsWithUploads)
  } catch (error) {
    console.error("Error fetching applications:", error)
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 })
  }
}
