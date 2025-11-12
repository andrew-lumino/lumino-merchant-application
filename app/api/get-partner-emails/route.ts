import { type NextRequest, NextResponse } from "next/server"
import Airtable from "airtable"

// --- Types (no `any`) ---
interface PartnerFields {
  "Primary Email"?: unknown
}

interface AgentFields {
  "Agent Email"?: unknown
}

interface SimpleRecord {
  id: string
  fields: PartnerFields | AgentFields
}

// --- Airtable setup ---
const AIRTABLE_BASE_ID = "appRygdwVIEtbUI1C"
const PARTNERS_TABLE_ID = "tbl4Ea0fxLzlGpuUd"
const PARTNERS_VIEW_ID = "viwEKsYrUYm5nlPxQ"
const AGENTS_TABLE_ID = "tblAzASni7ZaXGo0Y"
const AGENTS_VIEW_ID = "viwcEA7SOPyLl6Ype"

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(AIRTABLE_BASE_ID)

// --- Helpers ---
function toEmail(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().toLowerCase()
  // very light validation; adjust if you want stricter RFC checks
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null
}

async function fetchEmailsFromTable(tableId: string, viewId: string, emailField: string): Promise<string[]> {
  const records: SimpleRecord[] = []

  await base(tableId)
    .select({
      view: viewId,
      fields: [emailField],
    })
    .eachPage((page, next) => {
      // Cast to a simplified shape we control
      for (const r of page as unknown as SimpleRecord[]) records.push(r)
      next()
    })

  // Extract and normalize emails from this table
  return records.map((r) => toEmail((r.fields as any)[emailField])).filter((e): e is string => Boolean(e))
}

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Fetching partner emails from Airtable...")

    // Fetch emails from both tables in parallel
    const [partnerEmails, agentEmails] = await Promise.all([
      fetchEmailsFromTable(PARTNERS_TABLE_ID, PARTNERS_VIEW_ID, "Primary Email"),
      fetchEmailsFromTable(AGENTS_TABLE_ID, AGENTS_VIEW_ID, "Agent Email"),
    ])

    console.log("[v0] Partner emails found:", partnerEmails.length)
    console.log("[v0] Agent emails found:", agentEmails.length)
    console.log("[v0] All partner emails:", partnerEmails)
    console.log("[v0] All agent emails:", agentEmails)

    // Combine and dedupe all emails
    const allEmails = Array.from(new Set([...partnerEmails, ...agentEmails]))

    console.log("[v0] Total unique emails:", allEmails.length)
    console.log("[v0] Combined email list:", allEmails)

    return NextResponse.json({ success: true, emails: allEmails })
  } catch (err) {
    console.error("[v0] Error fetching partner emails from Airtable:", err)
    return NextResponse.json(
      { success: false, error: "Failed to fetch partner emails from Airtable." },
      { status: 500 },
    )
  }
}
