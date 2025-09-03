import { NextResponse } from "next/server";
import Airtable from "airtable";

// Airtable setup
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base("appRygdwVIEtbUI1C");

export async function GET() {
  const allRecords: any[] = [];

  try {
    await base("tblJGB8I2rNCl2frr")
      .select({
        view: "Grid view",
        // Remove this for now — re-add once you know which column marks Lumino compatibility
        // filterByFormula: "OR({Processor} = 'Lumino', {Vendor} = 'Lumino')",
      })
      .eachPage((records, fetchNextPage) => {
        allRecords.push(...records);
        fetchNextPage();
      });

    const terminals = allRecords
      .map((record) => {
        const fields = record.fields;

        // Safely handle price from number or string
        const rawPrice = fields["Partner Price"];
        let price = 0;

        if (typeof rawPrice === "number") {
          price = rawPrice;
        } else if (typeof rawPrice === "string") {
          const cleaned = rawPrice.replace(/[^0-9.-]+/g, "");
          price = parseFloat(cleaned) || 0;
        }

        return {
          id: record.id,
          name: fields["Equipment Name"] || "Unnamed Terminal",
          vendor: fields["Vendor"] || "Unknown",
          processor: fields["Processor"] || "Unknown",
          industryCategories: Array.isArray(fields["Industry Categories"])
            ? fields["Industry Categories"]
            : [],
          deviceCategory: fields["Device Category"] || "Uncategorized",
          price,
          imageUrl: Array.isArray(fields["Images"]) ? fields["Images"][0]?.url ?? null : null,
        };
      })
      .filter((t) => !!t.name && t.name !== "Unnamed Terminal"); // Optional: skip empty entries

    return NextResponse.json({ success: true, terminals });
  } catch (error) {
    console.error("Error fetching terminals from Airtable:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch terminals from Airtable." },
      { status: 500 }
    );
  }
}
