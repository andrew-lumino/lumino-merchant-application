import type { ReactNode } from "react"
import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await currentUser()
  console.log(user)

  if (!user) {
    redirect("/sign-in")
    return null
  }

  const email =
    user?.email ?? user?.emailAddresses?.[0]?.emailAddress ?? user?.primaryEmailAddressId ?? ""

  const isAuthorized = email.endsWith("@golumino.com")

  if (!isAuthorized) {
    redirect("/")
    return null // Just in case
  }

  return <>{children}</>
}
