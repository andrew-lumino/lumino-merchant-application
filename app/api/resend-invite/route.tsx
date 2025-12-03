import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { requireAuth, validateUUID, validateEmail } from "@/lib/auth"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.authorized) {
    return auth.response
  }

  try {
    const { expiredApplicationId } = await request.json()

    if (!expiredApplicationId) {
      return NextResponse.json({ success: false, error: "Expired Application ID is required" }, { status: 400 })
    }

    if (!validateUUID(expiredApplicationId)) {
      return NextResponse.json({ success: false, error: "Invalid application ID format" }, { status: 400 })
    }

    const { data: oldData, error: fetchError } = await supabase
      .from("merchant_applications")
      .select("*")
      .eq("id", expiredApplicationId)
      .single()

    if (fetchError) {
      console.error("Supabase error fetching expired app:", fetchError)
      return NextResponse.json({ success: false, error: "Could not find the original application." }, { status: 404 })
    }

    const { id, created_at, updated_at, status, ...newData } = oldData
    newData.status = "invited"

    const { data: newApplication, error: insertError } = await supabase
      .from("merchant_applications")
      .insert([newData])
      .select("id, dba_email")
      .single()

    if (insertError) {
      console.error("Supabase error creating new invite:", insertError)
      return NextResponse.json({ success: false, error: "Failed to create a new invitation." }, { status: 500 })
    }

    await supabase.from("merchant_applications").update({ status: "resent" }).eq("id", expiredApplicationId)

    const newInviteId = newApplication.id
    const merchantEmail = newApplication.dba_email
    const inviteLink = `https://apply.lumino.io/?id=${newInviteId}`

    if (merchantEmail && validateEmail(merchantEmail)) {
      await resend.emails.send({
        from: "Lumino <no-reply@golumino.com>",
        to: [merchantEmail, "apps@golumino.com"],
        subject: "Your Renewed Lumino Merchant Application is Ready",
        html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Your Merchant Application Link has been Renewed!</h2>
          <p>Hello,</p>
          <p>Your application link for Lumino's merchant services was expired, so we've generated a new one for you. All your previously entered information has been saved. Please click the link below to complete the final steps.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Complete Your Application
            </a>
          </div>
          <p>This new link will also expire in 30 days for security purposes.</p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
      `,
      })
    }

    return NextResponse.json({ success: true, newInviteId })
  } catch (error) {
    console.error("Error resending invite:", error)
    return NextResponse.json({ success: false, error: "Failed to resend invitation" }, { status: 500 })
  }
}
