import { currentUser } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export async function requireAuth() {
  const user = await currentUser()

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized - Authentication required" }, { status: 401 }),
      user: null,
      email: null,
    }
  }

  const email = user.email ?? user.emailAddresses?.[0]?.emailAddress ?? user.primaryEmailAddressId ?? ""

  if (!email.endsWith("@golumino.com")) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 }),
      user,
      email,
    }
  }

  return {
    authorized: true,
    response: null,
    user,
    email,
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

export function validateUrl(url: string, allowedDomains: string[]): boolean {
  try {
    const parsedUrl = new URL(url)
    return allowedDomains.some((domain) => parsedUrl.hostname.endsWith(domain))
  } catch {
    return false
  }
}
