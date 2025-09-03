import { type NextRequest, NextResponse } from "next/server"
import Airtable from "airtable"

// --- Types (no `any`) ---
interface PartnerFields {
  "Primary Email"?: unknown
}
interface SimpleRecord {
  id: string
  fields: PartnerFields
}

// --- Airtable setup ---
const AIRTABLE_BASE_ID = "appRygdwVIEtbUI1C"
const PARTNERS_TABLE_ID = "tbl4Ea0fxLzlGpuUd"
const PARTNERS_VIEW_ID = "viwEKsYrUYm5nlPxQ"

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

export async function GET(request: NextRequest) {
  const records: SimpleRecord[] = []

  try {
    await base(PARTNERS_TABLE_ID)
      .select({
        view: PARTNERS_VIEW_ID,
        fields: ["Primary Email"],
      })
      .eachPage((page, next) => {
        // Cast to a simplified shape we control
        for (const r of page as unknown as SimpleRecord[]) records.push(r)
        next()
      })

    // Collect, normalize, and dedupe emails
    const emails = Array.from(
      new Set(records.map((r) => toEmail(r.fields["Primary Email"])).filter((e): e is string => Boolean(e))),
    )

    return NextResponse.json({ success: true, emails })
  } catch (err) {
    console.error("Error fetching partner emails from Airtable:", err)
    return NextResponse.json(
      { success: false, error: "Failed to fetch partner emails from Airtable." },
      { status: 500 },
    )
  }
}
