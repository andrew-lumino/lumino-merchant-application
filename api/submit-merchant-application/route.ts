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
    console.log("API route called")

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

    // Enhanced: Process files with size validation and better error handling
    const uploadedFiles: Record<string, string> = {}
    const uploadErrors: string[] = []
    const skippedFiles: string[] = []

    // Process each file upload SEQUENTIALLY
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file_") && value instanceof File) {
        const uploadKey = key.replace("file_", "")
        console.log(
          `Processing file upload for ${uploadKey}: ${value.name} (${(value.size / 1024 / 1024).toFixed(2)}MB)`,
        )

        // Size validation: Skip files larger than 8MB
        if (value.size > 8 * 1024 * 1024) {
          console.error(`File too large: ${value.name} (${(value.size / 1024 / 1024).toFixed(2)}MB)`)
          skippedFiles.push(`${uploadKey}: ${value.name} (too large - max 8MB)`)
          continue
        }

        // Retry logic: Try upload with retries
        let uploadSuccess = false
        let retryCount = 0
        const maxRetries = 3
        while (!uploadSuccess && retryCount < maxRetries) {
          try {
            const fileName = `${data.dbaEmail?.replace(/[@.]/g, "_") || "unknown"}/${Date.now()}_${uploadKey}_${
              value.name
            }`
            const { error: uploadError } = await supabase.storage.from("merchant-uploads").upload(fileName, value, {
              cacheControl: "3600",
              upsert: false, // Prevent conflicts
            })

            if (uploadError) {
              throw uploadError
            }

            // Get public URL
            const {
              data: { publicUrl },
            } = supabase.storage.from("merchant-uploads").getPublicUrl(fileName)

            uploadedFiles[uploadKey] = publicUrl
            uploadSuccess = true
            console.log(`✅ File uploaded successfully: ${uploadKey} -> ${publicUrl}`)
          } catch (error) {
            retryCount++
            console.error(`Retry ${retryCount}/${maxRetries} failed for ${uploadKey}:`, error)
            if (retryCount < maxRetries) {
              // Wait before retrying (exponential backoff)
              await new Promise((resolve) => setTimeout(resolve, retryCount * 1000))
            }
          }
        }

        if (!uploadSuccess) {
          uploadErrors.push(`${uploadKey}: ${value.name}`)
          console.error(`❌ Final failure for ${uploadKey} after ${maxRetries} retries`)
        }

        // Rate limiting: Small delay between uploads
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    // Enhanced logging
    console.log(
      `Upload summary: ${Object.keys(uploadedFiles).length} successful, ${uploadErrors.length} failed, ${
        skippedFiles.length
      } skipped`,
    )

    // Insert into merchant_applications table
    const { data: application, error: applicationError } = await supabase
      .from("merchant_applications")
      .insert({
        agent_email: data.agentEmail || null,
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

        // Track upload status
        upload_status: uploadErrors.length > 0 || skippedFiles.length > 0 ? "partial" : "complete",
        upload_errors: [...uploadErrors, ...skippedFiles].join("; ") || null,

        // Signature
        agreement_scrolled: data.agreementScrolled || false,
        signature_full_name: data.signatureFullName || null,
        signature_date: data.signatureDate || null,
        certification_ack: data.certificationAck || false,
      })
      .select()
      .single()

    if (applicationError) {
      console.error("Database error:", applicationError)
      throw new Error(`Database error: ${applicationError.message}`)
    }

    console.log("Application inserted:", application.id)

    // Insert upload records into merchant_uploads table
    const uploadPromises: Promise<any>[] = []

    // Handle URL uploads from the original data
    if (data.uploads) {
      Object.entries(data.uploads).forEach(([documentType, upload]: [string, any]) => {
        if (upload?.uploadType === "url" && upload.url) {
          uploadPromises.push(
            supabase.from("merchant_uploads").insert({
              application_id: application.id,
              document_type: documentType,
              file_url: upload.url,
              upload_type: "url",
            }),
          )
        }
      })
    }

    // Handle file uploads
    Object.entries(uploadedFiles).forEach(([documentType, fileUrl]) => {
      uploadPromises.push(
        supabase.from("merchant_uploads").insert({
          application_id: application.id,
          document_type: documentType,
          file_url: fileUrl,
          upload_type: "file",
        }),
      )
    })

    if (uploadPromises.length > 0) {
      await Promise.all(uploadPromises)
      console.log("File upload records created")
    }

    // Send email notifications
    const emailHtml = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h1>New Merchant Application Received</h1>
        <p><strong>DBA Name:</strong> ${data.dbaName}</p>
        <p><strong>Email:</strong> ${data.dbaEmail}</p>
        <p><strong>Phone:</strong> ${data.dbaPhone}</p>
        <p><strong>Business Type:</strong> ${data.businessType}</p>
        <p><strong>Monthly Volume:</strong> $${data.monthlyVolume}</p>
        <p><strong>Account Manager:</strong> ${data.agentEmail || "Direct"}</p>
        <p><strong>Application ID:</strong> ${application.id}</p>
        <p>Please review the application in the admin dashboard.</p>
      </div>
    `

  // Zapier Webhook Integration (non-blocking) - COMPLETE DATA
  fetch(ZAPIER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // Meta information
      action: "merchant_application_submitted",
      applicationId: application.id,
      submittedAt: new Date().toISOString(),
      
      // Agent/Account Manager
      agentEmail: data.agentEmail,
      
      // Merchant Information
      dbaName: data.dbaName,
      dbaEmail: data.dbaEmail,
      ownershipType: data.ownershipType,
      legalName: data.legalName,
      federalTaxId: data.federalTaxId,
      dbaPhone: data.dbaPhone,
      websiteUrl: data.websiteUrl,
      paperlessStatements: data.paperlessStatements,
      
      // DBA Address
      dbaAddressLine1: data.dbaAddressLine1,
      dbaAddressLine2: data.dbaAddressLine2,
      dbaCity: data.dbaCity,
      dbaState: data.dbaState,
      dbaZip: data.dbaZip,
      dbaZipExtended: data.dbaZipExtended,
      
      // Legal Address
      legalDiffers: data.legalDiffers,
      legalAddressLine1: data.legalAddressLine1,
      legalAddressLine2: data.legalAddressLine2,
      legalCity: data.legalCity,
      legalState: data.legalState,
      legalZip: data.legalZip,
      legalZipExtended: data.legalZipExtended,
      
      // Business/Merchant Profile
      monthlyVolume: data.monthlyVolume,
      averageTicket: data.averageTicket,
      highestTicket: data.highestTicket,
      pctCardSwiped: data.pctCardSwiped,
      pctManualImprint: data.pctManualImprint,
      pctManualNoImprint: data.pctManualNoImprint,
      businessType: data.businessType,
      refundPolicy: data.refundPolicy,
      previousProcessor: data.previousProcessor,
      reasonForTermination: data.reasonForTermination,
      seasonalBusiness: data.seasonalBusiness,
      seasonalMonths: data.seasonalMonths,
      usesFulfillmentHouse: data.usesFulfillmentHouse,
      usesThirdParties: data.usesThirdParties,
      thirdPartiesList: data.thirdPartiesList,
      
      // Principals (owners/stakeholders)
      principals: data.principals,
      
      // Managing Member
      managingMemberSameAs: data.managingMemberSameAs,
      managingMemberReference: data.managingMemberReference,
      managingMemberFirstName: data.managingMemberFirstName,
      managingMemberLastName: data.managingMemberLastName,
      managingMemberEmail: data.managingMemberEmail,
      managingMemberPhone: data.managingMemberPhone,
      managingMemberPosition: data.managingMemberPosition,
      
      // Authorized Contact
      authorizedContactSameAs: data.authorizedContactSameAs,
      authorizedContactName: data.authorizedContactName,
      authorizedContactEmail: data.authorizedContactEmail,
      authorizedContactPhone: data.authorizedContactPhone,
      
      // Banking Information
      bankName: data.bankName,
      routingNumber: data.routingNumber,
      accountNumber: data.accountNumber,
      
      // Batching
      batchTime: data.batchTime,
      
      // Technical Contact
      technicalContactSameAs: data.technicalContactSameAs,
      technicalContactName: data.technicalContactName,
      technicalContactEmail: data.technicalContactEmail,
      technicalContactPhone: data.technicalContactPhone,
      
      // Upload Information
      uploadStatus: uploadErrors.length > 0 || skippedFiles.length > 0 ? "partial" : "complete",
      uploadErrors: uploadErrors,
      skippedFiles: skippedFiles,
      uploadSummary: {
        successful: Object.keys(uploadedFiles).length,
        failed: uploadErrors.length,
        skipped: skippedFiles.length,
      },
      uploads: { ...data.uploads, ...uploadedFiles },
      
      // Signature/Agreement
      agreementScrolled: data.agreementScrolled,
      signatureFullName: data.signatureFullName,
      signatureDate: data.signatureDate,
      certificationAck: data.certificationAck,
      
      // Application Status
      status: "submitted",
    }),
  }).catch((e) => console.error("Zapier webhook failed:", e))

    // Send emails
    try {
      console.log("Sending emails...")

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
            <p><strong>Application ID:</strong> ${application.id}</p>
            <p>If you have any questions, please contact us at apps@golumino.com</p>
            <p>Best regards,<br>The Lumino Team</p>
          </div>
        `,
      })

      console.log("Emails sent")
    } catch (emailError) {
      console.error("Email sending failed:", emailError)
      // Don't fail the whole request if email fails
    }

    console.log("Application submission completed successfully")
    // Enhanced response with upload status
    return NextResponse.json({
      success: true,
      applicationId: application.id,
      uploadSummary: {
        successful: Object.keys(uploadedFiles).length,
        failed: uploadErrors.length,
        skipped: skippedFiles.length,
        errors: uploadErrors,
        skippedFiles: skippedFiles,
      },
    })
  } catch (error) {
    console.error("Error submitting application:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit application",
      },
      { status: 500 },
    )
  }
}
