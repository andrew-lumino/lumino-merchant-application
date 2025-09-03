import { NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

// Function to send Zapier webhook with proper error handling
async function sendZapierWebhook(status: string, agentEmail: string, merchantEmail: string) {
  try {
    const webhookData = {
      status,
      agent_email: agentEmail,
      merchant_email: merchantEmail,
      timestamp: new Date().toISOString(),
    }
    
    console.log("📤 Sending Zapier webhook:", webhookData)
    
    const response = await fetch("https://hooks.zapier.com/hooks/catch/5609223/uui9oa1/", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(webhookData),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ Zapier webhook failed:", response.status, errorText)
      throw new Error(`Zapier webhook failed: ${response.status} ${errorText}`)
    } else {
      const responseText = await response.text()
      console.log("✅ Zapier webhook sent successfully:", responseText)
    }
  } catch (error) {
    console.error("❌ Zapier webhook error:", error)
    throw error // Re-throw to let caller know it failed
  }
}

export async function POST(req: Request) {
  try {
    const { emails, inviteId, agent_email } = await req.json()
    
    console.log("📨 Sending merchant invite:", { emails, inviteId, agent_email })

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      console.error("❌ No emails provided")
      return NextResponse.json(
        { success: false, error: "No emails provided" },
        { status: 400 }
      )
    }

    if (!inviteId) {
      console.error("❌ No invite ID provided")
      return NextResponse.json(
        { success: false, error: "No invite ID provided" },
        { status: 400 }
      )
    }

    if (!agent_email) {
      console.error("❌ No agent email provided")
      return NextResponse.json(
        { success: false, error: "No agent email provided" },
        { status: 400 }
      )
    }

    const baseUrl = "https://apply.golumino.com"
    const inviteLink = `${baseUrl}?id=${inviteId}`

    console.log("🔗 Generated invite link:", inviteLink)

    // Send emails to all recipients
    const emailPromises = emails.map((email: string) => {
      console.log(`📧 Sending email to: ${email}`)
      return resend.emails.send({
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
      })
    })

    // Wait for all emails to be sent
    const emailResults = await Promise.allSettled(emailPromises)
    
    // Check if any emails failed
    const failedEmails = emailResults
      .map((result, index) => ({ result, email: emails[index] }))
      .filter(({ result }) => result.status === 'rejected')

    if (failedEmails.length > 0) {
      console.error("❌ Some emails failed to send:", failedEmails)
      // Log the errors but continue with webhook
      failedEmails.forEach(({ result, email }) => {
        if (result.status === 'rejected') {
          console.error(`Failed to send to ${email}:`, result.reason)
        }
      })
    }

    console.log(`✅ Sent ${emails.length - failedEmails.length}/${emails.length} emails successfully`)

    // Send Zapier webhook for each email (or combined)
    const webhookPromises = emails.map(email => 
      sendZapierWebhook("merchant_application_draft", agent_email, email)
    )
    
    try {
      await Promise.all(webhookPromises)
      console.log("✅ All Zapier webhooks sent successfully")
    } catch (webhookError) {
      console.error("⚠️ Some Zapier webhooks failed (non-blocking):", webhookError)
      // Don't fail the main request if webhooks fail
    }

    // Return success even if some webhooks failed (emails are the main concern)
    return NextResponse.json({ 
      success: true, 
      message: `Invite sent successfully to ${emails.length - failedEmails.length}/${emails.length} recipients!`,
      failedEmails: failedEmails.length > 0 ? failedEmails.map(f => f.email) : undefined
    })

  } catch (error) {
    console.error("💥 Error in send-merchant-invite:", error)
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
