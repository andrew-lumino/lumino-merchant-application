"use client"

import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import Image from "next/image"
import { LayoutGrid, MailPlus, FileText, Handshake } from "lucide-react"

type AdminHeaderProps = { isAuthorized: boolean }

export default function AdminHeader({ isAuthorized }: AdminHeaderProps) {
  const pathname = usePathname()

  const items = [
    ...(isAuthorized
      ? [
          {
            href: "/admin",
            label: "Applications Manager",
            Icon: LayoutGrid,
            active: pathname === "/admin",
          },
        ]
      : []),
    {
      href: "/invite",
      label: "Invitation Manager",
      Icon: MailPlus,
      active: pathname === "/invite",
    },
    {
      href: "/",
      label: "Merchant Application",
      Icon: FileText,
      active: pathname === "/",
    },
    ...(isAuthorized
      ? [
          {
            href: "https://partner.golumino.com/admin",
            label: "Partner Application",
            Icon: Handshake,
            active: false,
          },
        ]
      : []),
  ]

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Brand: icon only on mobile, icon+text on md+ */}
        <Link href="/admin" className="flex items-center gap-2 text-gray-800">
          <Image src="/images/lumino-logo.png" alt="Lumino" width={20} height={20} className="h-10 w-10" />
          <span className="hidden md:inline text-xl font-bold">Lumino Admin</span>
          <span className="sr-only">Lumino Admin</span>
        </Link>

        {/* Scrollable icon nav on mobile; icon+label on md+ */}
        <nav
          className={clsx(
            "flex gap-4 md:gap-6 text-sm font-medium text-gray-600",
            // mobile overflow protection
            "overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-w-[70vw]",
          )}
          aria-label="Primary"
        >
          {items.map(({ href, label, Icon, active }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "group inline-flex items-center gap-2 px-1 py-2 hover:text-black transition-colors",
                active && "text-black font-semibold",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{label}</span>
              <span className="sr-only md:hidden">{label}</span>
            </Link>
          ))}
        </nav>

        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  )
}
