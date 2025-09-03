import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get("url")
    const filename = searchParams.get("filename")

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`)
    }

    const blob = await response.blob()

    return new NextResponse(blob, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename || "download"}"`,
        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
      },
    })
  } catch (error) {
    console.error("Error downloading file:", error)
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 })
  }
}
