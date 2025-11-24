import { currentUser } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

// Function to check admin status
export async function isAdmin(email: string): boolean {
  return email.endsWith("@golumino.com")
}

// Updated requireAuth to allow all authenticated users, with admin flag
export async function requireAuth(requireAdminAccess = true) {
  const user = await currentUser()

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized - Authentication required" }, { status: 401 }),
      user: null,
      email: null,
      isAdmin: false,
    }
  }

  const email = user.emailAddresses?.[0]?.emailAddress ?? ""
  const userIsAdmin = await isAdmin(email)

  if (requireAdminAccess && !userIsAdmin) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 }),
      user,
      email,
      isAdmin: false,
    }
  }

  return {
    authorized: true,
    response: null,
    user,
    email,
    isAdmin: userIsAdmin,
  }
}

// Existing code remains unchanged
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
