import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { currentUser } from "@clerk/nextjs/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userEmail = user.emailAddresses?.[0]?.emailAddress ?? ""

  try {
    const body = await request.json()
    const { applicationId, formData, principals, uploads, currentStep } = body

    console.log("[v0] Save-draft called for application:", applicationId)
    console.log("[v0] Principals received:", JSON.stringify(principals))
    console.log("[v0] Principals type:", typeof principals)
    console.log("[v0] Principals isArray:", Array.isArray(principals))
    console.log("[v0] Principals length:", principals?.length)

    if (!applicationId) {
      return NextResponse.json({ success: false, error: "Application ID required" }, { status: 400 })
    }

    // Check if application exists
    const { data: existingApp, error: fetchError } = await supabase
      .from("merchant_applications")
      .select("id, agent_email, status")
      .eq("id", applicationId)
      .single()

    if (fetchError || !existingApp) {
      console.error("[v0] Application not found:", applicationId, fetchError)
      return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 })
    }

    // Check permissions
    const isAdmin = userEmail.endsWith("@golumino.com")
    if (!isAdmin && existingApp.agent_email !== userEmail) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    // Only set status if not already submitted/approved
    if (formData?.status && !["submitted", "approved"].includes(existingApp.status)) {
      updateData.status = formData.status
    } else if (!existingApp.status || existingApp.status === "invited") {
      updateData.status = "drafted"
    }

    const fieldMapping: Record<string, string> = {
      dbaName: "dba_name",
      dbaEmail: "dba_email",
      ownershipType: "ownership_type",
      legalName: "legal_name",
      federalTaxId: "federal_tax_id",
      dbaPhone: "dba_phone",
      websiteUrl: "website_url",
      dbaAddressLine1: "dba_address_line1",
      dbaAddressLine2: "dba_address_line2",
      dbaCity: "dba_city",
      dbaState: "dba_state",
      dbaZip: "dba_zip",
      dbaZipExtended: "dba_zip_extended",
      legalAddressLine1: "legal_address_line1",
      legalAddressLine2: "legal_address_line2",
      legalCity: "legal_city",
      legalState: "legal_state",
      legalZip: "legal_zip",
      legalZipExtended: "legal_zip_extended",
      businessType: "business_type",
      refundPolicy: "refund_policy",
      previousProcessor: "previous_processor",
      reasonForTermination: "reason_for_termination",
      seasonalBusiness: "seasonal_business",
      acceptAmex: "accept_amex",
      acceptDebit: "accept_debit",
      acceptEbt: "accept_ebt",
      paperlessStatements: "paperless_statements",
      bankName: "bank_name",
      routingNumber: "routing_number",
      accountNumber: "account_number",
      batchTime: "batch_time",
      rateProgram: "rate_program",
      rateProgramValue: "rate_program_value",
      technicalContactName: "technical_contact_name",
      technicalContactEmail: "technical_contact_email",
      technicalContactPhone: "technical_contact_phone",
      technicalContactSameAs: "technical_contact_same_as",
      authorizedContactName: "authorized_contact_name",
      authorizedContactEmail: "authorized_contact_email",
      authorizedContactPhone: "authorized_contact_phone",
      authorizedContactSameAs: "authorized_contact_same_as",
      usesThirdParties: "uses_third_parties",
      thirdPartiesList: "third_parties_list",
      usesFulfillmentHouse: "uses_fulfillment_house",
      legalDiffers: "legal_differs",
      managingMemberSameAs: "managing_member_same_as",
      managingMemberReference: "managing_member_reference",
      managingMemberFirstName: "managing_member_first_name",
      managingMemberLastName: "managing_member_last_name",
      managingMemberEmail: "managing_member_email",
      managingMemberPhone: "managing_member_phone",
      managingMemberPosition: "managing_member_position",
    }

    const numericFields: Record<string, string> = {
      monthlyVolume: "monthly_volume",
      averageTicket: "average_ticket",
      highestTicket: "highest_ticket",
      pctCardSwiped: "pct_card_swiped",
      pctManualImprint: "pct_manual_imprint",
      pctManualNoImprint: "pct_manual_no_imprint",
    }

    // Process text/boolean fields
    if (formData) {
      for (const [camelKey, snakeKey] of Object.entries(fieldMapping)) {
        const value = formData[camelKey]
        if (value !== undefined && value !== null && value !== "") {
          updateData[snakeKey] = value
        }
      }

      // Process numeric fields - convert to number or null
      for (const [camelKey, snakeKey] of Object.entries(numericFields)) {
        const value = formData[camelKey]
        if (value !== undefined && value !== null && value !== "") {
          const numValue = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""))
          if (!isNaN(numValue)) {
            updateData[snakeKey] = numValue
          }
        }
      }

      // Handle seasonal_months array
      if (formData.seasonalMonths && Array.isArray(formData.seasonalMonths)) {
        updateData.seasonal_months = formData.seasonalMonths
      }

      // Handle terminals as JSONB
      if (formData.terminals) {
        updateData.terminals = formData.terminals
      }

      // Handle notes as JSONB
      if (formData.notes) {
        updateData.notes = formData.notes
      }
    }

    // The wizard always has at least one principal entry initialized
    if (principals !== undefined) {
      if (Array.isArray(principals)) {
        updateData.principals = principals
        console.log("[v0] Saving principals array with", principals.length, "entries")
      } else {
        console.log("[v0] Principals is not an array, skipping")
      }
    } else {
      console.log("[v0] Principals is undefined in request body")
    }

    console.log("[v0] Updating with fields:", Object.keys(updateData))

    const { data, error } = await supabase
      .from("merchant_applications")
      .update(updateData)
      .eq("id", applicationId)
      .select()

    if (error) {
      console.error("[v0] Error saving draft:", error.message, error.details, error.hint)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    console.log("[v0] Draft saved successfully, principals saved:", data?.[0]?.principals?.length || 0)
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("[v0] Error in save-draft:", error?.message || error)
    return NextResponse.json({ success: false, error: error?.message || "Failed to save draft" }, { status: 500 })
  }
}
