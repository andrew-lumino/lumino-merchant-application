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
    const { applicationId, formData, principals, uploads, currentStep, timestamp } = body

    console.log("[v0] Saving draft for application:", applicationId)

    if (!applicationId) {
      return NextResponse.json({ success: false, error: "Application ID required" }, { status: 400 })
    }

    const { data: existingApp, error: fetchError } = await supabase
      .from("merchant_applications")
      .select("id, agent_email")
      .eq("id", applicationId)
      .single()

    if (fetchError || !existingApp) {
      console.error("[v0] Application not found:", applicationId, fetchError)
      return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 })
    }

    const isAdmin = userEmail.endsWith("@golumino.com")
    if (!isAdmin && existingApp.agent_email !== userEmail) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
      status: formData.status || "drafted",
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
      monthlyVolume: "monthly_volume",
      averageTicket: "average_ticket",
      highestTicket: "highest_ticket",
      refundPolicy: "refund_policy",
      previousProcessor: "previous_processor",
      reasonForTermination: "reason_for_termination",
      pctCardSwiped: "pct_card_swiped",
      pctManualImprint: "pct_manual_imprint",
      pctManualNoImprint: "pct_manual_no_imprint",
      seasonalBusiness: "seasonal_business",
      seasonalMonths: "seasonal_months",
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
      authorizedContactName: "authorized_contact_name",
      authorizedContactEmail: "authorized_contact_email",
      authorizedContactPhone: "authorized_contact_phone",
      usesThirdParties: "uses_third_parties",
      thirdPartiesList: "third_parties_list",
      usesFulfillmentHouse: "uses_fulfillment_house",
      legalDiffers: "legal_differs",
    }

    for (const [camelKey, snakeKey] of Object.entries(fieldMapping)) {
      if (formData[camelKey] !== undefined && formData[camelKey] !== null) {
        updateData[snakeKey] = formData[camelKey]
      }
    }

    if (principals && Array.isArray(principals)) {
      updateData.principals = principals
    }

    if (formData.terminals) {
      updateData.terminals = formData.terminals
    }

    if (formData.notes) {
      updateData.notes = formData.notes
    }

    console.log("[v0] Updating with data:", Object.keys(updateData))

    const { data, error } = await supabase
      .from("merchant_applications")
      .update(updateData)
      .eq("id", applicationId)
      .select()

    if (error) {
      console.error("[v0] Error saving draft:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    console.log("[v0] Draft saved successfully")
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[v0] Error in save-draft:", error)
    return NextResponse.json({ success: false, error: "Failed to save draft" }, { status: 500 })
  }
}
