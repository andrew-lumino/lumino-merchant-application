import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"
import { currentUser } from "@clerk/nextjs/server"
import { Toaster } from "@/components/ui/toaster"
import AdminHeader from "@/components/admin-header"

const inter = Inter({ subsets: ["latin"] })
type AuthzResult = { isAuthorized: boolean; email: string | null }

/**
 * Checks if the current Clerk user is authorized.
 *
 * @param allowedUsers - Optional array of allowed user identifiers.
 *   - If empty: Any @golumino.com email is authorized.
 *   - If populated: Authorizes if user email matches an entry.
 *     Entries can be:
 *       - Full email address (e.g., "other@email.com")
 *       - Local-part only for golumino.com (e.g., "andrew")
 *
 * @returns Object with { isAuthorized: boolean, email: string | null }
 */
async function authorizeUser(allowedUsers: string[] = []) {
  const user = await currentUser()
  if (!user) return { isAuthorized: false, email: null }

  const email = user.email ||
    user.emailAddresses?.[0]?.emailAddress ||
    user.primaryEmailAddressId ||
    ""

  if (!email) return { isAuthorized: false, email: null }

  // If no specific users provided, allow any @golumino.com email
  if (allowedUsers.length === 0) {
    return { isAuthorized: email.endsWith("@golumino.com"), email }
  }

  const localPart = email.split("@")[0]

  const isAuthorized =
    allowedUsers.includes(email) || // Full email match
    allowedUsers.includes(localPart) // Local-part match for golumino.com

  return { isAuthorized, email }
}

export const metadata: Metadata = {
  title: "Lumino Merchant Application",
  description: "Apply for merchant services with Lumino",
  openGraph: {
    title: "Lumino Merchant Application",
    description: "Apply to become a Lumino Merchant and join our ecosystem.",
    url: "https://apply.golumino.com",
    siteName: "Lumino",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lumino Merchant Application",
    description: "Apply to become a Lumino Merchant and join our ecosystem.",
  },
  icons: {
    icon: "/favicon.ico",
  },
    generator: 'v0.app'
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await currentUser()
  const email =
    user?.email ?? user?.emailAddresses?.[0]?.emailAddress ?? user?.primaryEmailAddressId ?? ""

  const showHeader = email.endsWith("@golumino.com")

  const { isAuthorized } = await authorizeUser([
    "andrew",
    "giorgio",
    "zachry",
    "priscilla",
    "wesley"
  ])

  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          {showHeader && <AdminHeader isAuthorized={isAuthorized} />}
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  )
}
