import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: Request) {
  try {
    console.log("=== GENERATE MERCHANT INVITE API CALLED ===")

    const body = await req.json()
    console.log("Request body:", body)

    const { agent_email, merchant_email } = body

    console.log("Agent email:", agent_email)
    console.log("Merchant email:", merchant_email)

    // Determine the initial status based on whether this is for agent pre-fill or direct invite
    const initialStatus = merchant_email ? "invited" : "draft"
    console.log("Initial status:", initialStatus)

    const insertData = {
      agent_email: agent_email || null,
      status: initialStatus,
      dba_email: merchant_email || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    console.log("Insert data:", insertData)
    console.log("About to insert into database...")

    const { data, error } = await supabase.from("merchant_applications").insert(insertData).select("id").single()

    if (error) {
      console.error("❌ Supabase insert error:", error)
      console.error("Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error.details,
        },
        { status: 500 },
      )
    }

    console.log("✅ Application created successfully!")
    console.log("Created application data:", data)
    console.log(`Application ID: ${data.id} with status: ${initialStatus}`)

    if (initialStatus === "draft") {
      try {
        await fetch("https://hooks.zapier.com/hooks/catch/5609223/uui9oa1/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "merchant_application_draft",
            agent_email: agent_email,
            merchant_email: merchant_email || null,
          }),
        })
        console.log("✅ Zapier webhook sent for draft status")
      } catch (zapierError) {
        console.error("⚠️ Zapier webhook failed (non-blocking):", zapierError)
      }
    }

    try {
      await fetch(`${req.url.replace("/generate-merchant-invite", "/sync-airtable")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: data.id,
          action: "invite_created",
          data: insertData,
          agentEmail: agent_email,
          merchantEmail: merchant_email,
        }),
      })
      console.log("✅ Airtable sync initiated")
    } catch (airtableError) {
      console.error("⚠️ Airtable sync failed (non-blocking):", airtableError)
      // Don't fail the main request if Airtable sync fails
    }

    console.log("=== GENERATE MERCHANT INVITE API COMPLETED ===")
    return NextResponse.json({
      success: true,
      inviteId: data.id,
      status: initialStatus,
    })
  } catch (err: any) {
    console.error("💥 FATAL ERROR in generate-merchant-invite:", err)
    console.error("Error stack:", err?.stack)
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Internal Server Error",
        details: err?.stack,
      },
      { status: 500 },
    )
  }
}
