import { NextResponse } from "next/server"
import { validateUrl } from "@/lib/auth"

const ALLOWED_DOMAINS = ["blob.vercel-storage.com", "public.blob.vercel-storage.com", "lumino.io", "supabase.co"]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get("url")
    const filename = searchParams.get("filename")

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    if (!validateUrl(url, ALLOWED_DOMAINS)) {
      return NextResponse.json({ error: "Invalid URL - only allowed domains are permitted" }, { status: 403 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`)
    }

    const contentType = response.headers.get("Content-Type") || "application/octet-stream"
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]

    if (!allowedTypes.some((type) => contentType.includes(type))) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 403 })
    }

    const blob = await response.blob()

    const sanitizedFilename = (filename || "download").replace(/[^a-zA-Z0-9._-]/g, "_")

    return new NextResponse(blob, {
      headers: {
        "Content-Disposition": `attachment; filename="${sanitizedFilename}"`,
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    })
  } catch (error) {
    console.error("Error downloading file:", error)
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 })
  }
}
