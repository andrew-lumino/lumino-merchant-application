// api/save-prefill-data
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { currentUser } from "@clerk/nextjs/server"

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
    throw error
  }
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY)

// Define sensitive fields that should NOT be saved during pre-fill
const SENSITIVE_FIELDS = [
  "routingNumber",
  "accountNumber",
  "federalTaxId",
  "signatureFullName",
  "signatureDate",
  "certificationAck",
  "agreementScrolled",
]

const SENSITIVE_PRINCIPAL_FIELDS = ["ssn", "govIdNumber"]

// ✅ Define fields that should be numeric (and convert empty strings to null)
const NUMERIC_FIELDS = [
  "monthly_volume",
  "average_ticket",
  "highest_ticket",
  "pct_card_swiped",
  "pct_manual_imprint",
  "pct_manual_no_imprint",
]

// Improved snake_case to camelCase conversion
const snakeToCamel = (str: string) => {
  return str.replace(/([-_][a-z])/g, (group) => 
    group.toUpperCase().replace("-", "").replace("_", "")
  )
}

// Improved camelCase to snake_case conversion
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

// Enhanced convertKeysToCamelCase with better field mapping
const convertKeysToCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map((v) => convertKeysToCamelCase(v))
  } else if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc: Record<string, any>, key: string) => {
      const camelKey = snakeToCamel(key)
      
      // Handle special field mappings that might get lost
      const specialMappings: Record<string, string> = {
        'dob': 'dob', // Keep date of birth as is
        'gov_id_type': 'govIdType',
        'gov_id_number': 'govIdNumber', 
        'gov_id_expiration': 'govIdExpiration',
        'gov_id_state': 'govIdState',
        'address_line_1': 'addressLine1',
        'address_line_2': 'addressLine2',
        'zip_extended': 'zipExtended',
        'dba_address_line_1': 'dbaAddressLine1',
        'dba_address_line_2': 'dbaAddressLine2',
        'dba_zip_extended': 'dbaZipExtended',
        'legal_address_line_1': 'legalAddressLine1',
        'legal_address_line_2': 'legalAddressLine2', 
        'legal_zip_extended': 'legalZipExtended',
        'pct_card_swiped': 'pctCardSwiped',
        'pct_manual_imprint': 'pctManualImprint',
        'pct_manual_no_imprint': 'pctManualNoImprint',
        'monthly_volume': 'monthlyVolume',
        'average_ticket': 'averageTicket',
        'highest_ticket': 'highestTicket',
        'business_type': 'businessType',
        'refund_policy': 'refundPolicy',
        'previous_processor': 'previousProcessor',
        'reason_for_termination': 'reasonForTermination',
        'seasonal_business': 'seasonalBusiness',
        'seasonal_months': 'seasonalMonths',
        'uses_fulfillment_house': 'usesFulfillmentHouse',
        'uses_third_parties': 'usesThirdParties',
        'third_parties_list': 'thirdPartiesList'
      }
      
      const finalKey = specialMappings[key] || camelKey
      acc[finalKey] = convertKeysToCamelCase(obj[key])
      return acc
    }, {})
  }
  return obj
}

// Enhanced convertToSnakeCase with better field mapping  
function convertToSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(convertToSnakeCase)
  } else if (obj !== null && typeof obj === "object") {
    const converted: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = toSnakeCase(key)

      // Handle numeric fields specially
      if (NUMERIC_FIELDS.includes(snakeKey)) {
        converted[snakeKey] = cleanNumericValue(value)
      } else {
        converted[snakeKey] = convertToSnakeCase(value)
      }
    }
    return converted
  }
  return obj
}

export async function POST(request: Request) {
  try {
    console.log("=== SAVE PREFILL DATA API CALLED ===")

    const body = await request.json()
    console.log("Request body keys:", Object.keys(body))

    const { applicationId, formData, principals, merchantEmail, action } = body

    const user = await currentUser()
    const agentEmail = user?.email ?? user?.emailAddresses?.[0]?.emailAddress ?? user?.primaryEmailAddressId ?? ""

    console.log("Application ID:", applicationId)
    console.log("Action:", action)
    console.log("Merchant Email:", merchantEmail)
    console.log("Form Data keys:", formData ? Object.keys(formData) : "NO FORM DATA")
    console.log("Principals count:", principals ? principals.length : "NO PRINCIPALS")

    if (!applicationId) {
      console.error("❌ Missing application ID")
      return NextResponse.json({ success: false, error: "Application ID is required" }, { status: 400 })
    }

    if (!formData) {
      console.error("❌ Missing form data")
      return NextResponse.json({ success: false, error: "Form data is required" }, { status: 400 })
    }

    // First, verify the application exists
    console.log("🔍 Checking if application exists...")
    const { data: existingApp, error: fetchError } = await supabase
      .from("merchant_applications")
      .select("id, status, agent_email")
      .eq("id", applicationId)
      .single()

    if (fetchError) {
      console.error("❌ Error fetching application:", fetchError)
      return NextResponse.json(
        { success: false, error: `Application not found: ${fetchError.message}` },
        { status: 404 },
      )
    }

    console.log("✅ Found existing application:", existingApp)

    // Create a copy of the form data to modify
    const cleanData = { ...formData }
    console.log("Original form data sample:", {
      dbaName: cleanData.dbaName,
      dbaEmail: cleanData.dbaEmail,
      monthlyVolume: cleanData.monthlyVolume,
      averageTicket: cleanData.averageTicket,
    })

    // Remove sensitive fields from the top-level form data
    SENSITIVE_FIELDS.forEach((field) => {
      if (cleanData[field]) {
        console.log(`🚫 Removing sensitive field: ${field}`)
        delete cleanData[field]
      }
    })

    // Remove sensitive fields from each principal
    if (principals && Array.isArray(principals)) {
      cleanData.principals = principals.map((p: any, index: number) => {
        const cleanPrincipal = { ...p }
        SENSITIVE_PRINCIPAL_FIELDS.forEach((field) => {
          if (cleanPrincipal[field]) {
            console.log(`🚫 Removing sensitive principal field: ${field} from principal ${index}`)
            delete cleanPrincipal[field]
          }
        })
        return cleanPrincipal
      })
      console.log(`✅ Processed ${cleanData.principals.length} principals`)
    } else {
      cleanData.principals = []
      console.log("📝 No principals to process")
    }

    // Convert all camelCase keys to snake_case for database AND handle numeric fields
    console.log("🔄 Converting camelCase to snake_case and cleaning numeric fields...")
    const dbData = convertToSnakeCase(cleanData)
    console.log("Converted data sample:", {
      dba_name: dbData.dba_name,
      dba_email: dbData.dba_email,
      monthly_volume: dbData.monthly_volume,
      average_ticket: dbData.average_ticket,
    })

    // Prepare the update data
    const updateData = {
      ...dbData,
      dba_email: dbData.dba_email || merchantEmail,
      updated_at: new Date().toISOString(),
    }

    if (agentEmail) {
      updateData.agent_email = agentEmail
    }

    // ✅ Remove any undefined/null values that might cause issues (except for numeric nulls which are ok)
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
      // Convert empty strings to null for non-string fields
      if (
        updateData[key] === "" &&
        !key.includes("name") &&
        !key.includes("email") &&
        !key.includes("address") &&
        !key.includes("city")
      ) {
        updateData[key] = null
      }
    })

    console.log("📝 Final update data keys:", Object.keys(updateData))
    console.log("📝 Update data sample:", {
      dba_name: updateData.dba_name,
      dba_email: updateData.dba_email,
      monthly_volume: updateData.monthly_volume,
      average_ticket: updateData.average_ticket,
      updated_at: updateData.updated_at,
    })

    // Update the application with the cleaned, pre-filled data
    console.log("💾 Attempting database update...")
    const { data: updateResult, error: updateError } = await supabase
      .from("merchant_applications")
      .update(updateData)
      .eq("id", applicationId)
      .select() // Return the updated record

    if (updateError) {
      console.error("❌ Supabase update error:", updateError)
      console.error("Error details:", {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      })
      return NextResponse.json(
        {
          success: false,
          error: `Database update failed: ${updateError.message}`,
          details: updateError.details,
        },
        { status: 500 },
      )
    }

    console.log("✅ Database update successful!")
    console.log("Updated record:", updateResult)

    const inviteLink = `https://apply.golumino.com/?id=${applicationId}`
    console.log("🔗 Generated invite link:", inviteLink)

    // try {
    //   const baseUrl = new URL(request.url).origin
    //   await fetch(`${baseUrl}/api/sync-airtable`, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       applicationId,
    //       action: action === "send" ? "invite_sent" : "prefill_saved",
    //       data: updateData,
    //       agentEmail,
    //       merchantEmail,
    //     }),
    //   })
    //   console.log("✅ Airtable sync completed")
    // } catch (airtableError) {
    //   console.error("⚠️ Airtable sync failed (non-blocking):", airtableError)
    //   // Don't fail the main request if Airtable sync fails
    // }

    // Send Zapier webhook for all actions (both prefill and send)
    try {
      const webhookStatus = action === "send" ? "merchant_application_sent" : "merchant_application_prefilled"
      await sendZapierWebhook(webhookStatus, agentEmail, merchantEmail || "")
      console.log("✅ Zapier webhook completed")
    } catch (zapierError) {
      console.error("⚠️ Zapier webhook failed (non-blocking):", zapierError)
      // Don't fail the main request if Zapier webhook fails
    }

    // If the action is to send an email, send it
    if (action === "send" && merchantEmail) {
      console.log("📧 Sending email to:", merchantEmail)

      const terminals = dbData.terminals
      const terminalInfoHtml =
        terminals && terminals.length > 0
          ? `
         <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
           Your account manager has pre-selected the following terminal(s) for your business:
         </p>
         ${terminals
           .map((t: any) => {
             let priceHtml = ""
             if (t.price === t.original_price) {
               priceHtml = `<p style="margin: 0; font-size: 16px; font-weight: bold; color: #333;">Price: $${Number(t.price).toFixed(2)}</p>`
             } else if (t.price === 0) {
               priceHtml = `
                    <p style="margin: 0; font-size: 16px; font-weight: bold; color: #28a745;">
                        Price: FREE
                        <span style="text-decoration: line-through; color: #777; font-weight: normal; margin-left: 8px;">$${Number(t.original_price).toFixed(2)}</span>
                    </p>
                `
             } else {
               const discount = ((t.original_price - t.price) / t.original_price) * 100
               priceHtml = `
                    <p style="margin: 0; font-size: 16px; font-weight: bold; color: #333;">
                        Price: $${Number(t.price).toFixed(2)}
                        <span style="text-decoration: line-through; color: #777; font-weight: normal; margin-left: 8px;">$${Number(t.original_price).toFixed(2)}</span>
                        <span style="background-color: #d1e7dd; color: #0f5132; font-size: 12px; padding: 2px 6px; border-radius: 10px; margin-left: 8px; font-weight: normal;">${discount.toFixed(0)}% OFF</span>
                    </p>
                `
             }
             return `
                <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; background-color: #f9f9f9;">
                    <h4 style="margin: 0 0 5px 0; color: #1a1a1a;">${t.name}</h4>
                    ${priceHtml}
                </div>
            `
           })
           .join("")}
       `
          : ""

      try {
        await resend.emails.send({
          from: "Lumino <no-reply@golumino.com>",
          to: [merchantEmail, "apps@golumino.com"],
          subject: "Your Pre-filled Lumino Merchant Application is Ready",
          html: `
           <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
             <h2 style="color: #1a1a1a;">Your Merchant Application is Ready to Complete!</h2>
             <p>Hello,</p>
             <p>Your application for Lumino's merchant services has been pre-filled and is ready for your final review and signature. Please click the link below to complete the final steps.</p>
             ${terminalInfoHtml}
             <div style="text-align: center; margin: 30px 0;">
               <a href="${inviteLink}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                 Complete Your Application
               </a>
             </div>
             <p>This link will expire in 30 days for security purposes.</p>
             <p>If you have any questions, please contact our support team.</p>
           </div>
         `,
        })

        console.log("✅ Email sent successfully")

        // Update status to "invited" after sending email
        await supabase.from("merchant_applications").update({ status: "invited" }).eq("id", applicationId)

        console.log("✅ Status updated to 'invited'")
      } catch (emailError) {
        console.error("❌ Error sending email:", emailError)
        // Don't fail the main request if email fails
      }
    }

    console.log("=== SAVE PREFILL DATA API COMPLETED SUCCESSFULLY ===")
    return NextResponse.json({ success: true, link: inviteLink })
  } catch (error) {
    console.error("💥 FATAL ERROR in save-prefill-data:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
