import { currentUser } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const ADMIN_USERS = ["andrew", "giorgio", "zachry", "david", "garrett", "priscilla", "wesley"]

export function isAdmin(email: string): boolean {
  if (!email) return false

  // Extract first part of email (before @)
  const emailPrefix = email.toLowerCase().split("@")[0]

  // Check if user is in admin list AND has @golumino.com email
  return email.toLowerCase().endsWith("@golumino.com") && ADMIN_USERS.includes(emailPrefix)
}

export function isLuminoStaff(email: string): boolean {
  return email.toLowerCase().endsWith("@golumino.com")
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
      isLuminoStaff: false,
    }
  }

  const email = user.emailAddresses?.[0]?.emailAddress ?? ""
  const userIsAdmin = isAdmin(email)
  const userIsLuminoStaff = isLuminoStaff(email)

  if (requireAdminAccess && !userIsLuminoStaff) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 }),
      user,
      email,
      isAdmin: false,
      isLuminoStaff: false,
    }
  }

  return {
    authorized: true,
    response: null,
    user,
    email,
    isAdmin: userIsAdmin,
    isLuminoStaff: userIsLuminoStaff,
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
