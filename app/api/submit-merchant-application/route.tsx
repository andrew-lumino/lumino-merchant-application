import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

let supabase: any
let resend: any

try {
  supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  resend = new Resend(process.env.RESEND_API_KEY)
} catch (error) {
  console.error("Failed to initialize services:", error)
}

function buildZapAirtableFields(params: {
  applicationId: string
  data: {
    agentEmail?: string
    agentName?: string
    dbaName?: string
    dbaEmail?: string
    dbaPhone?: string
    ownershipType?: string
    legalName?: string
    websiteUrl?: string

    // DBA address
    dbaAddressLine1?: string
    dbaAddressLine2?: string
    dbaCity?: string
    dbaState?: string
    dbaZip?: string
    dbaZipExtended?: string

    // Legal address
    legalDiffers?: boolean
    legalAddressLine1?: string
    legalAddressLine2?: string
    legalCity?: string
    legalState?: string
    legalZip?: string
    legalZipExtended?: string

    // Profile / underwriting
    monthlyVolume?: string | number
    averageTicket?: string | number
    highestTicket?: string | number
    pctCardSwiped?: string | number
    pctManualImprint?: string | number
    pctManualNoImprint?: string | number
    businessType?: string
    refundPolicy?: string
    previousProcessor?: string // "credit processor"
    reasonForTermination?: string
    seasonalBusiness?: boolean
    seasonalMonths?: string[] | string
    usesFulfillmentHouse?: boolean
    usesThirdParties?: boolean
    thirdPartiesList?: string

    // People
    principals?: Array<{
      firstName?: string
      lastName?: string
      position?: string
      equity?: string | number
      email?: string
    }>

    // Managing member
    managingMemberSameAs?: boolean
    managingMemberReference?: string
    managingMemberFirstName?: string
    managingMemberLastName?: string
    managingMemberEmail?: string
    managingMemberPhone?: string
    managingMemberPosition?: string

    // Authorized contact
    authorizedContactSameAs?: boolean
    authorizedContactName?: string
    authorizedContactEmail?: string
    authorizedContactPhone?: string

    // Technical contact
    technicalContactSameAs?: boolean
    technicalContactName?: string
    technicalContactEmail?: string
    technicalContactPhone?: string

    // Banking
    bankName?: string
    routingNumber?: string
    accountNumber?: string

    // Batching
    batchTime?: string

    // Signature
    agreementScrolled?: boolean
    signatureFullName?: string
    signatureDate?: string
    certificationAck?: boolean

    // Compliance
    federalTaxId?: string

    // Terminals / uploads
    terminals?: Array<{ name: string; price: number; originalPrice?: number }>
    uploads?: Record<string, { uploadType: "url"; url: string } | undefined>
  }
  uploadedFiles: Record<string, string>
}) {
  const { applicationId, data, uploadedFiles } = params

  // Addresses as single strings (fine for Airtable Long text)
  const dbaAddress = [
    data.dbaAddressLine1 ?? "",
    data.dbaAddressLine2 ?? "",
    [data.dbaCity, data.dbaState, [data.dbaZip, data.dbaZipExtended].filter(Boolean).join("-")]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ")

  const legalAddress = [
    data.legalAddressLine1 ?? "",
    data.legalAddressLine2 ?? "",
    [data.legalCity, data.legalState, [data.legalZip, data.legalZipExtended].filter(Boolean).join("-")]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ")

  // Principals summary (plus optional breakout for the first two)
  const principals = data.principals ?? []
  const principalsSummary = principals
    .map((p, i) => {
      const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim()
      const bits: string[] = []
      if (name) bits.push(`${i + 1}. ${name}`)
      if (p.position) bits.push(`Position: ${p.position}`)
      if (p.equity != null && `${p.equity}` !== "") bits.push(`Equity: ${p.equity}%`)
      if (p.email) bits.push(`Email: ${p.email}`)
      return bits.join(" | ")
    })
    .join("\n")

  const principalField = (idx: number, key: "Name" | "Email" | "Position" | "Equity") => {
    const p = principals[idx]
    if (!p) return ""
    if (key === "Name") return [p.firstName, p.lastName].filter(Boolean).join(" ").trim()
    if (key === "Email") return p.email ?? ""
    if (key === "Position") return p.position ?? ""
    if (key === "Equity") return p.equity != null ? `${p.equity}` : ""
    return ""
  }

  // Terminals summary
  const terminalsSummary = (data.terminals ?? [])
    .map((t) => {
      const base = `${t.name}: $${Number(t.price).toFixed(2)}`
      if (t.originalPrice && t.originalPrice !== t.price) {
        return `${base} | Original: $${Number(t.originalPrice).toFixed(2)}`
      }
      return base
    })
    .join("\n")

  // Uploads mapping (keep exact em dash if that's what Airtable uses)
  const uploadMap: Record<string, string> = {
    businessLicense: "Uploads — Business License",
    taxId: "Uploads — Tax Id",
    articlesOfIncorporation: "Uploads — Articles of Incorporation",
    interiorExteriorPhotos: "Uploads — Interior/Exterior Photos",
    otherSupportingPapers: "Uploads — Other Supporting Papers",
    twoConsecutiveStatements: "Uploads — Two Consecutive Statements",
    voidedCheck: "Uploads — Voided Check",
  }

  const mergedUploads: Record<string, string> = {}
  const addUpload = (label: string, url?: string) => {
    if (url) mergedUploads[label] = url
  }
  Object.entries(data.uploads ?? {}).forEach(([k, v]) => {
    if (v?.uploadType === "url" && v.url && uploadMap[k]) addUpload(uploadMap[k], v.url)
  })
  Object.entries(uploadedFiles).forEach(([k, url]) => {
    if (uploadMap[k]) addUpload(uploadMap[k], url)
  })

  // Final flat record (UPDATE NAMES to your Airtable columns exactly)
  const record: Record<string, unknown> = {
    // meta
    merchant_application_submitted: true,
    "Application Id": applicationId,
    "Submitted At": new Date().toISOString(),

    // basic
    "Agent Email": data.agentEmail ?? "",
    "Agent Name": data.agentName ?? "",
    "Dba Name": data.dbaName ?? "",
    "Dba Email": data.dbaEmail ?? "",
    "Dba Phone": data.dbaPhone ?? "",
    "Ownership Type": data.ownershipType ?? "",
    "Legal Name": data.legalName ?? "",
    "Federal Tax Id": data.federalTaxId ?? "", // <-- Fed ID
    Website: data.websiteUrl ?? "",

    // addresses (long text ok)
    "DBA Address": dbaAddress,
    "Legal Address": data.legalDiffers ? legalAddress : "",

    // processing profile
    "Business Type": data.businessType ?? "",
    "Monthly Volume": Number(data.monthlyVolume ?? 0),
    "Average Ticket": Number(data.averageTicket ?? 0),
    "Highest Ticket": Number(data.highestTicket ?? 0),
    "Pct Card Swiped": Number(data.pctCardSwiped ?? 0),
    "Pct Manual Imprint": Number(data.pctManualImprint ?? 0),
    "Pct Manual No Imprint": Number(data.pctManualNoImprint ?? 0),
    "Refund Policy": data.refundPolicy ?? "",
    "Previous Processor": data.previousProcessor ?? "", // <-- credit processor
    "Reason For Termination": data.reasonForTermination ?? "",
    "Seasonal Business": !!data.seasonalBusiness,
    "Seasonal Months": Array.isArray(data.seasonalMonths)
      ? data.seasonalMonths.join(", ")
      : typeof data.seasonalMonths === "string"
        ? data.seasonalMonths
        : "",
    "Uses Fulfillment House": !!data.usesFulfillmentHouse,
    "Uses Third Parties": !!data.usesThirdParties,
    "Third Parties List": data.thirdPartiesList ?? "",

    // terminals
    Terminals: terminalsSummary,

    // owners & officers
    Principals: principalsSummary,
    "Principal 1 Name": principalField(0, "Name"),
    "Principal 1 Email": principalField(0, "Email"),
    "Principal 1 Position": principalField(0, "Position"),
    "Principal 1 Equity": principalField(0, "Equity"),
    "Principal 2 Name": principalField(1, "Name"),
    "Principal 2 Email": principalField(1, "Email"),
    "Principal 2 Position": principalField(1, "Position"),
    "Principal 2 Equity": principalField(1, "Equity"),

    // managing member
    "Managing Member — Same As": !!data.managingMemberSameAs,
    "Managing Member — Reference": data.managingMemberReference ?? "",
    "Managing Member — Name": [data.managingMemberFirstName, data.managingMemberLastName]
      .filter(Boolean)
      .join(" ")
      .trim(),
    "Managing Member — Email": data.managingMemberEmail ?? "",
    "Managing Member — Phone": data.managingMemberPhone ?? "",
    "Managing Member — Position": data.managingMemberPosition ?? "",

    // authorized contact
    "Authorized Contact — Same As": !!data.authorizedContactSameAs,
    "Authorized Contact — Name": data.authorizedContactName ?? "",
    "Authorized Contact — Email": data.authorizedContactEmail ?? "",
    "Authorized Contact — Phone": data.authorizedContactPhone ?? "",

    // technical contact
    "Technical Contact — Same As": !!data.technicalContactSameAs,
    "Technical Contact — Name": data.technicalContactName ?? "",
    "Technical Contact — Email": data.technicalContactEmail ?? "",
    "Technical Contact — Phone": data.technicalContactPhone ?? "",

    // banking (⚠️ sensitive—ensure your Airtable permissions/PII policy)
    "Bank Name": data.bankName ?? "",
    "Routing Number": data.routingNumber ?? "",
    "Account Number": data.accountNumber ?? "",
    "Batch Time": data.batchTime ?? "10:45 PM EST",

    // signature
    "Signed Name": data.signatureFullName ?? "",
    "Signed Date": data.signatureDate ?? "",
  }

  Object.assign(record, mergedUploads)
  return record
}

const ZAPIER_URL = "https://hooks.zapier.com/hooks/catch/5609223/uui9oa1/"

export async function GET() {
  return NextResponse.json({
    message: "API route is working",
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasResendKey: !!process.env.RESEND_API_KEY,
  })
}

export async function POST(request: Request) {
  try {
    console.log("=== SUBMIT MERCHANT APPLICATION API CALLED ===")

    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables")
    }
    if (!process.env.RESEND_API_KEY) {
      console.warn("Missing Resend API key - emails will not be sent")
    }

    // Parse FormData
    const formData = await request.formData()
    console.log("FormData parsed")

    // Get the JSON data
    const jsonDataString = formData.get("data") as string
    if (!jsonDataString) {
      throw new Error("No data field found in FormData")
    }

    const data = JSON.parse(jsonDataString)
    console.log("JSON data parsed successfully")
    console.log("Application ID from data:", data.id)
    console.log("Uploads from data:", data.uploads)

    // FIXED: Process uploaded files from the JSON data structure
    const uploadedFiles: Record<string, string> = {}

    // Process uploads from the JSON data (URLs from earlier Supabase uploads)
    if (data.uploads) {
      Object.entries(data.uploads).forEach(([key, upload]: [string, any]) => {
        if (upload?.uploadType === "file" && upload.url) {
          uploadedFiles[key] = upload.url
          console.log(`✅ Found file upload: ${key} -> ${upload.url}`)
        } else if (upload?.uploadType === "url" && upload.url) {
          uploadedFiles[key] = upload.url
          console.log(`✅ Found URL upload: ${key} -> ${upload.url}`)
        }
      })
    }

    console.log("Processed uploaded files:", uploadedFiles)

    // FIXED: Handle database operation - UPDATE existing or INSERT new
    let application
    let applicationError

    const updateData = {
      status: "submitted",

      // Merchant Information
      dba_name: data.dbaName || null,
      dba_email: data.dbaEmail || null,
      ownership_type: data.ownershipType || null,
      legal_name: data.legalName || null,
      federal_tax_id: data.federalTaxId || null,
      dba_phone: data.dbaPhone || null,
      website_url: data.websiteUrl || null,
      paperless_statements: data.paperlessStatements || false,

      // DBA Address
      dba_address_line1: data.dbaAddressLine1 || null,
      dba_address_line2: data.dbaAddressLine2 || null,
      dba_city: data.dbaCity || null,
      dba_state: data.dbaState || null,
      dba_zip: data.dbaZip || null,
      dba_zip_extended: data.dbaZipExtended || null,

      // Legal Address
      legal_differs: data.legalDiffers || false,
      legal_address_line1: data.legalAddressLine1 || null,
      legal_address_line2: data.legalAddressLine2 || null,
      legal_city: data.legalCity || null,
      legal_state: data.legalState || null,
      legal_zip: data.legalZip || null,
      legal_zip_extended: data.legalZipExtended || null,

      // Merchant Profile
      monthly_volume: Number.parseFloat(data.monthlyVolume) || 0,
      average_ticket: Number.parseFloat(data.averageTicket) || 0,
      highest_ticket: Number.parseFloat(data.highestTicket) || 0,
      pct_card_swiped: Number.parseFloat(data.pctCardSwiped) || 0,
      pct_manual_imprint: Number.parseFloat(data.pctManualImprint) || 0,
      pct_manual_no_imprint: Number.parseFloat(data.pctManualNoImprint) || 0,
      business_type: data.businessType || null,
      refund_policy: data.refundPolicy || null,
      previous_processor: data.previousProcessor || null,
      reason_for_termination: data.reasonForTermination || null,
      seasonal_business: data.seasonalBusiness || false,
      seasonal_months: data.seasonalMonths || [],
      uses_fulfillment_house: data.usesFulfillmentHouse || false,
      uses_third_parties: data.usesThirdParties || false,
      third_parties_list: data.thirdPartiesList || null,
      terminals: data.terminals || [],

      // Principals
      principals: data.principals || [],

      // Managing Member
      managing_member_same_as: data.managingMemberSameAs || false,
      managing_member_reference: data.managingMemberReference || null,
      managing_member_first_name: data.managingMemberFirstName || null,
      managing_member_last_name: data.managingMemberLastName || null,
      managing_member_email: data.managingMemberEmail || null,
      managing_member_phone: data.managingMemberPhone || null,
      managing_member_position: data.managingMemberPosition || null,

      // Authorized Contact
      authorized_contact_same_as: data.authorizedContactSameAs || false,
      authorized_contact_name: data.authorizedContactName || null,
      authorized_contact_email: data.authorizedContactEmail || null,
      authorized_contact_phone: data.authorizedContactPhone || null,

      // Banking
      bank_name: data.bankName || null,
      routing_number: data.routingNumber || null,
      account_number: data.accountNumber || null,

      // Batching
      batch_time: data.batchTime || "10:45 PM EST",

      // Technical Contact
      technical_contact_same_as: data.technicalContactSameAs || false,
      technical_contact_name: data.technicalContactName || null,
      technical_contact_email: data.technicalContactEmail || null,
      technical_contact_phone: data.technicalContactPhone || null,

      // Signature
      agreement_scrolled: data.agreementScrolled || false,
      signature_full_name: data.signatureFullName || null,
      signature_date: data.signatureDate || null,
      certification_ack: data.certificationAck || false,

      updated_at: new Date().toISOString(),
    }

    if (data.id) {
      // Update existing application
      console.log("🔄 Updating existing application:", data.id)
      const { data: updatedApp, error: updateError } = await supabase
        .from("merchant_applications")
        .update(updateData)
        .eq("id", data.id)
        .select()
        .single()

      application = updatedApp
      applicationError = updateError
    } else {
      // Create new application (fallback case)
      console.log("➕ Creating new application")
      const { data: newApp, error: insertError } = await supabase
        .from("merchant_applications")
        .insert({
          agent_email: data.agentEmail || null,
          agent_name: data.agentName || null,
          ...updateData,
        })
        .select()
        .single()

      application = newApp
      applicationError = insertError
    }

    if (applicationError) {
      console.error("Database error:", applicationError)
      throw new Error(`Database error: ${applicationError.message}`)
    }

    console.log("✅ Application processed:", application.id)

    // FIXED: Delete any existing upload records and create new ones
    console.log("🗑️ Cleaning up existing upload records...")
    await supabase.from("merchant_uploads").delete().eq("application_id", application.id)

    // Insert upload records into merchant_uploads table
    const uploadPromises: Promise<any>[] = []

    Object.entries(uploadedFiles).forEach(([documentType, fileUrl]) => {
      const uploadType = data.uploads?.[documentType]?.uploadType || "file"
      uploadPromises.push(
        supabase.from("merchant_uploads").insert({
          application_id: application.id,
          document_type: documentType,
          file_url: fileUrl,
          upload_type: uploadType,
        }),
      )
      console.log(`📎 Queuing upload record: ${documentType} -> ${fileUrl}`)
    })

    if (uploadPromises.length > 0) {
      const uploadResults = await Promise.all(uploadPromises)
      console.log("✅ Upload records created:", uploadResults.length)
    } else {
      console.log("⚠️ No uploads to process")
    }

    // Sync with Airtable
    try {
      const baseUrl = new URL(request.url).origin
      const airtableResponse = await fetch(`${baseUrl}/api/sync-airtable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: application.id,
          action: "application_submitted",
          data: {
            ...data,
            // Include uploaded file URLs
            uploads: uploadedFiles,
          },
          agentEmail: data.agentEmail,
          merchantEmail: data.dbaEmail,
        }),
      })

      if (airtableResponse.ok) {
        console.log("✅ Airtable sync completed successfully")
      } else {
        console.error("⚠️ Airtable sync failed (non-blocking)")
      }
    } catch (airtableError) {
      console.error("⚠️ Airtable sync failed (non-blocking):", airtableError)
      // Don't fail the main request if Airtable sync fails
    }

    const terminals = data.terminals
    const terminalsHtml =
      terminals && terminals.length > 0
        ? `
       <p><strong>Selected Terminals:</strong></p>
       <ul>
         ${terminals.map((t: any) => `<li>${t.name} - $${Number(t.price).toFixed(2)}</li>`).join("")}
       </ul>
     `
        : ""

    // Send email notifications
    const emailHtml = `
     <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
       <h1>New Merchant Application Received</h1>
       <p><strong>DBA Name:</strong> ${data.dbaName}</p>
       <p><strong>Email:</strong> ${data.dbaEmail}</p>
       <p><strong>Phone:</strong> ${data.dbaPhone}</p>
       <p><strong>Business Type:</strong> ${data.businessType}</p>
       <p><strong>Monthly Volume:</strong> $${data.monthlyVolume}</p>
       ${terminalsHtml}
       <p><strong>Uploaded Files:</strong> ${Object.keys(uploadedFiles).length} files</p>
       <p><strong>Account Manager:</strong> ${data.agentEmail || "Direct"}</p>
       <p><strong>Application ID:</strong> ${application.id}</p>
       <p>Please review the application in the admin dashboard.</p>
     </div>
   `

    // Zapier Webhook Integration (non-blocking)
    const airtableFields = buildZapAirtableFields({
      applicationId: application.id,
      data,
      uploadedFiles,
    })
    const zapRes = await fetch(ZAPIER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "merchant_application_submitted",
        // ⬇️ Put all flattened columns at the top level (no nesting under `fields`)
        ...airtableFields,
      }),
    })
    if (!zapRes.ok) {
      console.error("Zapier non-200:", zapRes.status, await zapRes.text().catch(() => ""))
    } else {
      console.log("✅ Zapier webhook sent successfully")
    }

    // Send emails
    try {
      console.log("📧 Sending emails...")

      // Send to admin
      await resend.emails.send({
        from: "Lumino <no-reply@golumino.com>",
        to: ["apps@golumino.com"],
        subject: "New Merchant Application",
        html: emailHtml,
      })

      // Send confirmation to applicant
      await resend.emails.send({
        from: "Lumino <no-reply@golumino.com>",
        to: [data.dbaEmail],
        subject: "Lumino Merchant Application Received",
        html: `
         <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
           <h1>Thank you for your application!</h1>
           <p>Dear ${data.dbaName},</p>
           <p>We have successfully received your merchant application. Our underwriting team will review your submission and contact you within 24-48 hours.</p>
           ${terminalsHtml}
           <p><strong>Application ID:</strong> ${application.id}</p>
           <p>If you have any questions, please contact us at apps@golumino.com</p>
           <p>Best regards,<br>The Lumino Team</p>
         </div>
       `,
      })

      console.log("✅ Emails sent")
    } catch (emailError) {
      console.error("❌ Email sending failed:", emailError)
      // Don't fail the whole request if email fails
    }

    console.log("=== APPLICATION SUBMISSION COMPLETED SUCCESSFULLY ===")
    return NextResponse.json({ success: true, applicationId: application.id })
  } catch (error) {
    console.error("💥 FATAL ERROR in submit application:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit application",
      },
      { status: 500 },
    )
  }
}
