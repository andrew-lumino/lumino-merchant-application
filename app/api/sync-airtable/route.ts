import { NextResponse } from "next/server"

const AIRTABLE_BASE_ID = "appRygdwVIEtbUI1C"
const AIRTABLE_TABLE_ID = "tblfUeuJrV6xJRnNi"
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`

interface AirtableRecord {
  id?: string
  fields: Record<string, any>
}

interface SyncRequest {
  applicationId: string
  action: "invite_created" | "prefill_saved" | "invite_sent" | "application_submitted"
  data: any
  agentEmail?: string
  merchantEmail?: string
}

// Map form data to exact Airtable field names
function mapToAirtableFields(
  data: any,
  applicationId: string,
  action: string,
  agentEmail?: string,
  merchantEmail?: string,
): Record<string, any> {
  const fields: Record<string, any> = {}

  fields["Application Comments"] = applicationId

  // Set status based on action
  switch (action) {
    case "invite_created":
      fields["Status"] = "Pending"
      break
    case "prefill_saved":
      fields["Status"] = "Pending"
      break
    case "invite_sent":
      fields["Status"] = "Pending Signature"
      break
    case "application_submitted":
      fields["Status"] = "Underwriting"
      break
  }

  // Basic information
  if (agentEmail) fields["Partner Email"] = agentEmail
  if (merchantEmail) fields["Business Email"] = merchantEmail
  if (data.dbaName || data.dba_name) fields["Merchant Name (DBA)"] = data.dbaName || data.dba_name
  if (data.dbaEmail || data.dba_email) fields["Business Email"] = data.dbaEmail || data.dba_email
  if (data.dbaPhone || data.dba_phone) fields["Phone"] = data.dbaPhone || data.dba_phone
  if (data.monthlyVolume || data.monthly_volume) {
    const volume = Number(data.monthlyVolume || data.monthly_volume)
    if (!isNaN(volume)) fields["Volume"] = `$${volume.toFixed(2)}`
  }
  if (data.ownershipType || data.ownership_type) fields["Ownership Type"] = data.ownershipType || data.ownership_type
  if (data.federalTaxId || data.federal_tax_id) fields["Federal Tax ID"] = data.federalTaxId || data.federal_tax_id
  if (data.websiteUrl || data.website_url) fields["Merchant Website"] = data.websiteUrl || data.website_url
  if (data.businessType || data.business_type) {
    fields["Business Type of Merchant"] = data.businessType || data.business_type
    fields["Industry Type"] = data.businessType || data.business_type
  }
  if (data.averageTicket || data.average_ticket) {
    const ticket = Number(data.averageTicket || data.average_ticket)
    if (!isNaN(ticket)) fields["Average Ticket"] = ticket
  }
  if (data.highestTicket || data.highest_ticket) {
    const ticket = Number(data.highestTicket || data.highest_ticket)
    if (!isNaN(ticket)) fields["Highest Ticket"] = ticket
  }
  if (data.pctCardSwiped || data.pct_card_swiped) {
    const pct = Number(data.pctCardSwiped || data.pct_card_swiped)
    if (!isNaN(pct)) fields["Percentage of Card Swiped Transactions"] = `${pct.toFixed(2)}%`
  }
  if (data.pctManualImprint || data.pct_manual_imprint) {
    const pct = Number(data.pctManualImprint || data.pct_manual_imprint)
    if (!isNaN(pct)) fields["Manual with Imprint"] = `${pct.toFixed(2)}%`
  }
  if (data.pctManualNoImprint || data.pct_manual_no_imprint) {
    const pct = Number(data.pctManualNoImprint || data.pct_manual_no_imprint)
    if (!isNaN(pct)) fields["Manual without Imprint"] = `${pct.toFixed(2)}%`
  }
  if (data.refundPolicy || data.refund_policy) fields["Refund Policy"] = data.refundPolicy || data.refund_policy
  if (data.previousProcessor || data.previous_processor)
    fields["Credit Processor"] = data.previousProcessor || data.previous_processor
  if (data.reasonForTermination || data.reason_for_termination)
    fields["Reason for Termination"] = data.reasonForTermination || data.reason_for_termination

  // Address fields
  const dbaAddress = [
    data.dbaAddressLine1 || data.dba_address_line1,
    data.dbaAddressLine2 || data.dba_address_line2,
    [
      data.dbaCity || data.dba_city,
      data.dbaState || data.dba_state,
      [data.dbaZip || data.dba_zip, data.dbaZipExtended || data.dba_zip_extended].filter(Boolean).join("-"),
    ]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ")

  if (dbaAddress) fields["DBA Address"] = dbaAddress

  const legalAddress = [
    data.legalAddressLine1 || data.legal_address_line1,
    data.legalAddressLine2 || data.legal_address_line2,
    [
      data.legalCity || data.legal_city,
      data.legalState || data.legal_state,
      [data.legalZip || data.legal_zip, data.legalZipExtended || data.legal_zip_extended].filter(Boolean).join("-"),
    ]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ")

  if (legalAddress && (data.legalDiffers || data.legal_differs)) {
    fields["Legal Address"] = legalAddress
  }

  // Principals/Owners information
  const principals = data.principals || []
  if (principals.length > 0) {
    const principalsSummary = principals
      .map((p: any, i: number) => {
        const name = [p.firstName || p.first_name, p.lastName || p.last_name].filter(Boolean).join(" ").trim()
        const bits: string[] = []
        if (name) bits.push(`${i + 1}. ${name}`)
        if (p.position) bits.push(`Position: ${p.position}`)
        if (p.equity != null && `${p.equity}` !== "") bits.push(`Equity: ${p.equity}%`)
        if (p.email) bits.push(`Email: ${p.email}`)
        return bits.join(" | ")
      })
      .join("\n")

    fields["Owners and Officers Information"] = principalsSummary
    fields["Business Principals"] = principalsSummary

    if (principals[0]) {
      const firstName = principals[0].firstName || principals[0].first_name
      const lastName = principals[0].lastName || principals[0].last_name
      if (firstName || lastName) {
        fields["Full Name"] = [firstName, lastName].filter(Boolean).join(" ").trim()
      }
    }
  }

  // Managing Member Info
  const managingMemberName = [
    data.managingMemberFirstName || data.managing_member_first_name,
    data.managingMemberLastName || data.managing_member_last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim()

  if (managingMemberName) {
    const managingMemberInfo = [
      managingMemberName,
      data.managingMemberEmail || data.managing_member_email || "",
      data.managingMemberPhone || data.managing_member_phone || "",
    ]
      .filter(Boolean)
      .join(" ")

    fields["Managing Member Info"] = managingMemberInfo
  }

  // Authorized Contact Info
  if (data.authorizedContactName || data.authorized_contact_name) {
    const authorizedContactInfo = [
      data.authorizedContactName || data.authorized_contact_name,
      data.authorizedContactEmail || data.authorized_contact_email || "",
    ]
      .filter(Boolean)
      .join(" ")

    fields["Authorized Contact Info"] = authorizedContactInfo
  }

  // Technical Contact Info
  if (data.technicalContactName || data.technical_contact_name) {
    const technicalContactInfo = [
      data.technicalContactName || data.technical_contact_name,
      data.technicalContactEmail || data.technical_contact_email || "",
    ]
      .filter(Boolean)
      .join(" ")

    fields["Technical Contact Info"] = technicalContactInfo
  }

  // Banking Info
  if (data.bankName || data.bank_name) fields["Bank Name"] = data.bankName || data.bank_name
  if (data.routingNumber || data.routing_number) {
    const routing = Number(data.routingNumber || data.routing_number)
    if (!isNaN(routing)) fields["Routing / ABA #"] = routing
  }
  if (data.accountNumber || data.account_number) {
    const account = Number(data.accountNumber || data.account_number)
    if (!isNaN(account)) fields["Checking / Saving Account #"] = account
  }
  if (data.batchTime || data.batch_time) fields["Batch Time (EST)"] = data.batchTime || data.batch_time

  // Set submitted date for completed applications
  if (action === "application_submitted") {
    fields["Submitted Date"] = new Date().toISOString().split("T")[0]
  }

  // Add timestamps
  fields["Status Update"] = new Date().toISOString().split("T")[0]
  fields["Last Modified"] = new Date().toISOString().split("T")[0]

  console.log("Mapped Airtable fields:", JSON.stringify(fields, null, 2))

  return fields
}

async function findExistingRecord(applicationId: string): Promise<string | null> {
  try {
    const response = await fetch(`${AIRTABLE_API_URL}?filterByFormula={Application ID}="${applicationId}"`, {
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      console.error("Airtable search failed:", response.status, await response.text())
      return null
    }

    const result = await response.json()
    return result.records?.[0]?.id || null
  } catch (error) {
    console.error("Error searching Airtable:", error)
    return null
  }
}

async function createOrUpdateRecord(applicationId: string, fields: Record<string, any>): Promise<boolean> {
  try {
    // First, check if record exists
    const existingRecordId = await findExistingRecord(applicationId)

    let response: Response

    if (existingRecordId) {
      // Update existing record
      console.log(`Updating existing Airtable record: ${existingRecordId}`)
      response = await fetch(`${AIRTABLE_API_URL}/${existingRecordId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields }),
      })
    } else {
      // Create new record
      console.log(`Creating new Airtable record for application: ${applicationId}`)
      response = await fetch(AIRTABLE_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields }),
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Airtable API error:", response.status, errorText)
      return false
    }

    const result = await response.json()
    console.log("Airtable sync successful:", result.id)
    return true
  } catch (error) {
    console.error("Error syncing to Airtable:", error)
    return false
  }
}

async function deleteRecord(applicationId: string): Promise<boolean> {
  try {
    // First, find the existing record
    const existingRecordId = await findExistingRecord(applicationId)

    if (!existingRecordId) {
      console.log(`No Airtable record found to delete for application: ${applicationId}`)
      return true // Consider it successful if there's nothing to delete
    }

    // Delete the record
    console.log(`Deleting Airtable record: ${existingRecordId}`)
    const response = await fetch(`${AIRTABLE_API_URL}/${existingRecordId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Airtable delete error:", response.status, errorText)
      return false
    }

    console.log("Airtable record deleted successfully:", existingRecordId)
    return true
  } catch (error) {
    console.error("Error deleting Airtable record:", error)
    return false
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.AIRTABLE_API_KEY) {
      console.error("Missing AIRTABLE_API_KEY environment variable")
      return NextResponse.json({ success: false, error: "Airtable API key not configured" }, { status: 500 })
    }

    const { applicationId, action, data, agentEmail, merchantEmail }: SyncRequest = await request.json()

    if (!applicationId) {
      return NextResponse.json({ success: false, error: "Application ID is required" }, { status: 400 })
    }

    console.log(`Syncing to Airtable: ${action} for application ${applicationId}`)

    if (action === "application_submitted") {
      // Delete the invite record since the application is now submitted
      const deleteSuccess = await deleteRecord(applicationId)
      if (deleteSuccess) {
        console.log("Airtable invite record deleted successfully")
        return NextResponse.json({ success: true, action: "deleted" })
      } else {
        console.error("Airtable invite record deletion failed")
        return NextResponse.json({ success: false, error: "Failed to delete Airtable invite record" }, { status: 500 })
      }
    }

    // Map data to Airtable fields for other actions
    const airtableFields = mapToAirtableFields(data, applicationId, action, agentEmail, merchantEmail)

    // Create or update record in Airtable
    const success = await createOrUpdateRecord(applicationId, airtableFields)

    if (success) {
      console.log("Airtable sync completed successfully")
      return NextResponse.json({ success: true })
    } else {
      console.error("Airtable sync failed")
      return NextResponse.json({ success: false, error: "Failed to sync to Airtable" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error in Airtable sync API:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
