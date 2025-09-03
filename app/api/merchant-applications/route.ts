import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page") || "1");
    const limit = Number.parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Fetch merchant applications with related uploads
    const { data, error } = await supabase
      .from("merchant_applications")
      .select(
        `
        *,
        uploads:merchant_uploads(document_type, file_url, upload_type)
      `
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform uploads array into object for easier UI rendering
    const appsWithUploads = data.map((app: any) => ({
      ...app,
      uploads: app.uploads.reduce((acc: any, u: any) => {
        acc[u.document_type] = {
          file_url: u.file_url,
          upload_type: u.upload_type,
        };
        return acc;
      }, {}),
    }));

    return NextResponse.json(appsWithUploads);
  } catch (error) {
    console.error("Error fetching applications:", error);
    return NextResponse.json(
      { error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
}
