import { NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { emails, inviteId, agent_email } = await req.json()

    const baseUrl = "https://apply.golumino.com"
    const inviteLink = `${baseUrl}?id=${inviteId}`

    const emailPromises = emails.map((email: string) =>
      resend.emails.send({
        from: "Lumino <no-reply@golumino.com>",
        to: ["apps@golumino.com", email],
        subject: "You're Invited to Apply for Lumino Merchant Services",
        html: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1a1a1a; font-size: 28px;">LUMINO</h1>
              <p style="color: #666; font-size: 14px;">Payments with Purpose</p>
            </div>
            
            <h2 style="color: #1a1a1a;">You're Invited to Apply for Merchant Services!</h2>
            
            <p>Hello,</p>
            
            <p>You've been invited to apply for Lumino's merchant payment processing services. We're excited to potentially welcome you to our growing network of merchants who are transforming their payment processing experience.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Complete Your Application
              </a>
            </div>
            
            <p><strong>What makes Lumino different:</strong></p>
            <ul>
              <li>Competitive processing rates</li>
              <li>Next-generation payment gateway</li>
              <li>Built-in customer loyalty features</li>
              <li>Transparent pricing with no hidden fees</li>
              <li>Dedicated merchant support</li>
            </ul>
            
            <p>The application takes approximately 10-15 minutes to complete. Our underwriting team will review your submission and contact you within 24-48 hours.</p>
            
            <p>If you have any questions, feel free to contact our <a href="mailto:support@golumino.com">merchant team</a>.</p>
            
            <p>We look forward to serving your business!</p>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
              <p>Lumino Technologies<br>
              4201 Main St Suite 201, Houston, TX 77002<br>
              1-866-488-4168 | www.golumino.com</p>
            </div>
          </div>
        `,
      }),
    )

    await Promise.all(emailPromises)

    try {
      await fetch("https://hooks.zapier.com/hooks/catch/5609223/uui9oa1/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "merchant_application_sent",
          agent_email: agent_email,
          merchant_email: emails.join(", "), // Join multiple emails if any
        }),
      })
      console.log("✅ Zapier webhook sent for sent status")
    } catch (zapierError) {
      console.error("⚠️ Zapier webhook failed (non-blocking):", zapierError)
    }

    return NextResponse.json({ success: true, message: "Invite sent successfully!" })
  } catch (error) {
    console.error("Error sending invite:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send invite",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}
