import { NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { emails, agent_email } = await req.json()

    // Validate inputs
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid emails provided" },
        { status: 400 }
      )
    }

    // Improved email validation regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    
    // Better email parsing and validation
    const validEmails = emails
      .flatMap(email => {
        // Handle cases where emails might be passed as a single string with delimiters
        if (typeof email === 'string' && (email.includes(',') || email.includes(';'))) {
          return email.split(/[,;\n]/).map(e => e.trim())
        }
        return [email]
      })
      .map(email => typeof email === 'string' ? email.trim().toLowerCase() : '')
      .filter(email => email && emailRegex.test(email))
    
    // Remove duplicates
    const uniqueEmails = Array.from(new Set(validEmails))
    
    if (uniqueEmails.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid email addresses found" },
        { status: 400 }
      )
    }

    const baseUrl = "https://apply.golumino.com"
    const results = {
      successful: [] as string[],
      failed: [] as { email: string, error: string }[],
      skipped: [] as string[]
    }

    // Check for existing invites to avoid duplicates
    const { data: existingInvites } = await supabase
      .from("merchant_applications")
      .select("dba_email")
      .in("dba_email", uniqueEmails)
      .eq("status", "invited")

    const existingEmails = new Set(existingInvites?.map(inv => inv.dba_email) || [])
    
    // Separate new emails from existing ones
    const newEmails = uniqueEmails.filter(email => !existingEmails.has(email))
    const skippedEmails = uniqueEmails.filter(email => existingEmails.has(email))
    
    results.skipped = skippedEmails

    // Process new emails with rate limiting (to avoid overwhelming email service)
    const batchSize = 10 // Process 10 at a time
    const delay = 100 // 100ms between batches
    
    for (let i = 0; i < newEmails.length; i += batchSize) {
      const batch = newEmails.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (email: string) => {
        try {
          // Create invite record
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

          // Send email with retry logic
          await sendEmailWithRetry(email, inviteLink, 3)

          results.successful.push(email)
          return { success: true, email, id: data.id }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.failed.push({ email, error: errorMessage })
          console.error(`Failed to process ${email}:`, error)
          return { success: false, email, error: errorMessage }
        }
      })

      await Promise.all(batchPromises)
      
      // Add delay between batches to avoid rate limits
      if (i + batchSize < newEmails.length) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // Build response message
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
        skippedEmails: results.skipped
      }
    })
  } catch (error) {
    console.error("Error sending multiple invites:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send invites",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}

// Helper function to send email with retry logic
async function sendEmailWithRetry(email: string, inviteLink: string, maxRetries: number) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await resend.emails.send({
        from: "Lumino <no-reply@golumino.com>",
        to: [email],
        subject: "You're Invited to Apply for Lumino Merchant Services",
        html: getEmailTemplate(inviteLink),
      })
      return // Success, exit retry loop
    } catch (error) {
      console.error(`Attempt ${attempt} failed for ${email}:`, error)
      
      if (attempt === maxRetries) {
        throw error // Final attempt failed, throw error
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, attempt * 1000))
    }
  }
}

// Extract email template to separate function for cleaner code
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
