import { NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { emails, agent_email } = await req.json()

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ success: false, error: "No valid emails provided" }, { status: 400 })
    }

    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

    const validEmails = emails
      .flatMap((email) => {
        if (typeof email === "string" && (email.includes(",") || email.includes(";"))) {
          return email.split(/[,;\n]/).map((e) => e.trim())
        }
        return [email]
      })
      .map((email) => (typeof email === "string" ? email.trim().toLowerCase() : ""))
      .filter((email) => email && emailRegex.test(email))

    const uniqueEmails = Array.from(new Set(validEmails))

    if (uniqueEmails.length === 0) {
      return NextResponse.json({ success: false, error: "No valid email addresses found" }, { status: 400 })
    }

    const baseUrl = "https://apply.golumino.com"
    const results = {
      successful: [] as string[],
      failed: [] as { email: string; error: string }[],
      skipped: [] as string[],
    }

    // Check for existing invites
    const { data: existingInvites } = await supabase
      .from("merchant_applications")
      .select("dba_email")
      .in("dba_email", uniqueEmails)
      .eq("status", "invited")

    const existingEmails = new Set(existingInvites?.map((inv) => inv.dba_email) || [])
    const newEmails = uniqueEmails.filter((email) => !existingEmails.has(email))
    const skippedEmails = uniqueEmails.filter((email) => existingEmails.has(email))
    results.skipped = skippedEmails

    // Process in batches
    const batchSize = 10
    const delay = 100

    for (let i = 0; i < newEmails.length; i += batchSize) {
      const batch = newEmails.slice(i, i + batchSize)
      const batchItems: Array<{ email: string; inviteLink: string; dbId: string }> = []

      // Create DB rows first
      const createPromises = batch.map(async (email: string) => {
        try {
          const { data, error } = await supabase
            .from("merchant_applications")
            .insert({
              agent_email: agent_email || null,
              status: "invited",
              dba_email: email,
              created_at: new Date().toISOString(),
            })
            .select("id")
            .single()

          if (error) throw error

          const inviteLink = `${baseUrl}?id=${data.id}`
          batchItems.push({ email, inviteLink, dbId: data.id })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          results.failed.push({ email, error: errorMessage })
          console.error(`Failed to create invite row for ${email}:`, error)
        }
      })

      await Promise.all(createPromises)

      // Send batch emails if we have any
      if (batchItems.length > 0) {
        await sendBatchEmails(batchItems, results, agent_email)
      }

      if (i + batchSize < newEmails.length) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // Send notification to agent if there were failures
    if (results.failed.length > 0 && agent_email) {
      await sendFailureNotification(agent_email, results)
    }

    let message = `Successfully sent ${results.successful.length} invites`
    if (results.skipped.length > 0) {
      message += `, skipped ${results.skipped.length} existing invites`
    }
    if (results.failed.length > 0) {
      message += `, ${results.failed.length} failed`
    }

    return NextResponse.json({
      success: true,
      message,
      results: {
        total: uniqueEmails.length,
        successful: results.successful.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        failedEmails: results.failed,
        skippedEmails: results.skipped,
      },
    })
  } catch (error) {
    console.error("Error sending multiple invites:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send invites",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}

async function sendBatchEmails(
  items: Array<{ email: string; inviteLink: string; dbId: string }>,
  results: { successful: string[]; failed: Array<{ email: string; error: string }> },
  agent_email: string | null
) {
  const payload = items.map((it) => ({
    from: "Lumino <no-reply@golumino.com>",
    to: [it.email],
    subject: "You're Invited to Apply for Lumino Merchant Services",
    html: getEmailTemplate(it.inviteLink),
  }))

  try {
    const res = await resend.batch.send(payload)
    const data = (res as any).data ?? []
    const errors = (res as any).error ? [{ index: 0, message: (res as any).error.message }] : []

    const errorByIndex = new Map<number, string>()
    for (const e of errors) {
      errorByIndex.set(e.index, e.message)
    }

    let dataPointer = 0
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (errorByIndex.has(i)) {
        const errMsg = errorByIndex.get(i) ?? "Unknown resend error"
        await supabase
          .from("merchant_applications")
          .update({ status: "invited" }) // Keep as invited but log the error
          .eq("id", item.dbId)
        
        results.failed.push({ email: item.email, error: errMsg })
        console.warn(`Resend batch item failed (index ${i}) for ${item.email}: ${errMsg}`)
      } else {
        const resendId = data[dataPointer]?.id
        dataPointer++
        
        await supabase
          .from("merchant_applications")
          .update({ status: "invited" })
          .eq("id", item.dbId)
        
        results.successful.push(item.email)

        // Zapier webhook (non-blocking)
        try {
          await fetch("https://hooks.zapier.com/hooks/catch/5609223/uui9oa1/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "merchant_application_draft",
              agent_email: agent_email,
              merchant_email: item.email,
            }),
          })
        } catch (zapierError) {
          console.error("⚠️ Zapier webhook failed (non-blocking):", zapierError)
        }
      }
    }
  } catch (batchErr) {
    console.error("Resend batch send failed, falling back to individual sends:", batchErr)

    // Fallback to individual sends
    for (const item of items) {
      try {
        await resend.emails.send({
          from: "Lumino <no-reply@golumino.com>",
          to: [item.email],
          subject: "You're Invited to Apply for Lumino Merchant Services",
          html: getEmailTemplate(item.inviteLink),
        })

        await supabase
          .from("merchant_applications")
          .update({ status: "invited" })
          .eq("id", item.dbId)
        
        results.successful.push(item.email)

        // Zapier webhook
        try {
          await fetch("https://hooks.zapier.com/hooks/catch/5609223/uui9oa1/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "merchant_application_draft",
              agent_email: agent_email,
              merchant_email: item.email,
            }),
          })
        } catch (zapierError) {
          console.error("⚠️ Zapier webhook failed (non-blocking):", zapierError)
        }
      } catch (singleErr) {
        const message = singleErr instanceof Error ? singleErr.message : "Unknown send error"
        results.failed.push({ email: item.email, error: message })
      }
    }
  }
}

async function sendFailureNotification(
  agent_email: string,
  results: { failed: Array<{ email: string; error: string }>; successful: string[] }
) {
  try {
    const failedList = results.failed
      .map((f) => `• ${f.email}: ${f.error}`)
      .join("\n")

    await resend.emails.send({
      from: "Lumino <no-reply@golumino.com>",
      to: [agent_email],
      subject: "Merchant Invite Batch - Some Failures Reported",
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <h2>Invite Batch Summary</h2>
          <p><strong>Successful:</strong> ${results.successful.length}</p>
          <p><strong>Failed:</strong> ${results.failed.length}</p>
          
          <h3>Failed Invites:</h3>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${failedList}</pre>
          
          <p>Please review these failures and retry if needed.</p>
        </div>
      `,
    })
  } catch (error) {
    console.error("Failed to send notification email:", error)
  }
}

function getEmailTemplate(inviteLink: string): string {
  return `
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
  `
}
